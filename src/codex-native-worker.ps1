# Trusted Windows supervisor. This process owns a kill-on-close Job Object;
# its children inherit the job before they execute. No PID discovery/taskkill.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.IO;

public static class ObserverNativeJob {
  [StructLayout(LayoutKind.Sequential)] struct BasicLimit {
    public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass, SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)] struct IoCounters {
    public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
    public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
  }
  [StructLayout(LayoutKind.Sequential)] struct ExtendedLimit {
    public BasicLimit BasicLimitInformation;
    public IoCounters IoInfo;
    public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimit info, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
  static IntPtr job;
  static Timer deadline;
  public static void Enter(int timeoutMs) {
    job = CreateJobObject(IntPtr.Zero, null);
    var limits = new ExtendedLimit();
    limits.BasicLimitInformation.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if (job == IntPtr.Zero || !SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits)) ||
        !AssignProcessToJobObject(job, Process.GetCurrentProcess().Handle)) throw new InvalidOperationException("job-unavailable");
    // Independent of Node's timer: a lost parent cannot leave native work running.
    deadline = new Timer(delegate { TerminateJobObject(job, 124); }, null, timeoutMs, Timeout.Infinite);
  }
  public sealed class Result {
    public string stdout = "";
    public string stderr = "";
    public int stderrBytes;
    public int exitCode;
    public bool outputLimit;
  }
  // Windows CreateProcess argv quoting, not a shell command string.
  static string Quote(string value) {
    var output = new StringBuilder("\""); int slashes = 0;
    foreach (char c in value) {
      if (c == '\\') { slashes++; continue; }
      if (c == '"') { output.Append('\\', slashes * 2 + 1); output.Append(c); }
      else { output.Append('\\', slashes); output.Append(c); }
      slashes = 0;
    }
    output.Append('\\', slashes * 2); return output.Append('"').ToString();
  }
  public static Result Run(string program, string[] args, string input, int maxBytes) {
    var command = new StringBuilder();
    foreach (string arg in args) { if (command.Length > 0) command.Append(' '); command.Append(Quote(arg)); }
    var info = new ProcessStartInfo(program, command.ToString()) {
      UseShellExecute = false, CreateNoWindow = true,
      RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
      StandardOutputEncoding = new UTF8Encoding(false), StandardErrorEncoding = new UTF8Encoding(false)
    };
    var result = new Result(); int bytes = 0;
    using (var process = Process.Start(info)) {
      Func<StreamReader, bool, Task> drain = (reader, error) => Task.Run(() => {
        var buffer = new char[2048]; var text = new StringBuilder(); int count;
        while ((count = reader.Read(buffer, 0, buffer.Length)) > 0) {
          int size = Encoding.UTF8.GetByteCount(buffer, 0, count);
          if (error) result.stderrBytes += size;
          if (Interlocked.Add(ref bytes, size) > maxBytes) {
            result.outputLimit = true;
            // Closing the supervisor will also close every job descendant.
            try { process.Kill(); } catch (InvalidOperationException) {}
            continue;
          }
          // stderr is classified below and is never returned to Observer or logs.
          if (!error || text.Length < 8192) text.Append(buffer, 0, count);
        }
        if (error) result.stderr = text.ToString(); else result.stdout = text.ToString();
      });
      Task output = drain(process.StandardOutput, false), errors = drain(process.StandardError, true);
      try { using (var writer = new StreamWriter(process.StandardInput.BaseStream, new UTF8Encoding(false))) { writer.Write(input); } }
      catch (IOException) { /* Preserve the CLI's actual rejection and stderr class. */ }
      process.WaitForExit(); Task.WaitAll(output, errors); result.exitCode = process.ExitCode;
    }
    return result;
  }
}
'@
try {
  $launch = [Console]::In.ReadLine() | ConvertFrom-Json
  [ObserverNativeJob]::Enter([int]$launch.timeoutMs)
  $version = [ObserverNativeJob]::Run([string]$launch.program, [string[]]@('--version'), '', 8192)
  if ($version.exitCode -ne 0 -or $version.stdout.Trim() -ne 'codex-cli 0.153.4') {
    @{ version = $version.stdout.Trim(); stdout = ''; exitCode = $null; diagnostic = 'cli-failure'; outputLimit = $version.outputLimit } | ConvertTo-Json -Compress
    exit 0
  }
  $run = [ObserverNativeJob]::Run([string]$launch.program, [string[]]$launch.args, [string]$launch.prompt, [int]$launch.maxBytes)
  $diagnostic = $null
  if ($run.exitCode -ne 0) {
    $diagnostic = if ($run.stderr -match '(?i)schema') { 'schema' }
      elseif ($run.stderr -match '(?i)auth|log.?in|credential') { 'authentication' }
      elseif ($run.stderr -match '(?i)sandbox') { 'sandbox' }
      elseif ($run.stderr -match '(?i)config|unknown field') { 'configuration' }
      elseif ($run.stderr -match '(?i)quota|usage limit|rate limit|not supported|not available|forbidden|403') { 'provider-rejected' }
      elseif ($run.stderr -match '(?i)connect|network|stream disconnected') { 'connection' }
      else { 'cli-failure' }
  }
  @{ version = $version.stdout.Trim(); stdout = $run.stdout; exitCode = $run.exitCode; diagnostic = $diagnostic; outputLimit = $run.outputLimit } | ConvertTo-Json -Compress
} catch {
  # Never print exception text: it can contain local paths or source material.
  @{ version = 'unknown'; stdout = ''; exitCode = $null; diagnostic = 'cli-failure'; outputLimit = $false } | ConvertTo-Json -Compress
}
# The Job handle is deliberately held for this entire supervisor lifetime.
# Kernel handle closure on exit/cancel/deadline kills only this owned process tree.
