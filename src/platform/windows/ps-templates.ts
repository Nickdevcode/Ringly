export interface ToastScriptParams {
  appId: string;
  toastXml: string;
}

/**
 * Builds the PowerShell script that loads the toast XML and invokes the
 * WinRT ToastNotificationManager. The script is passed to powershell.exe
 * via `-EncodedCommand` (UTF-16 LE + base64) by `runPowerShell`, so the
 * surrounding shell never parses it — there is no shell-injection surface
 * here, only PowerShell-string-literal injection inside the template.
 *
 * Defense in depth — two independent escape layers run before the values
 * land in the script:
 *   1. The caller (toast.ts) runs every user-controlled field through
 *      `escapeXmlText`, which turns single quotes into `&apos;` and any
 *      character outside printable ASCII into `&#N;` entities. After
 *      this step `toastXml` cannot contain a raw `'`.
 *   2. We still do `replace(/'/g, "''")` below. It's redundant for the
 *      XML (already neutralised in step 1) but mandatory for `appId`,
 *      which comes from config and never goes through `escapeXmlText`.
 *      In PowerShell single-quoted strings, `''` is the literal `'` and
 *      no other character (including backtick, `$`, `;`) is interpolated,
 *      so this fully neutralises the value as a literal.
 */
export function buildToastScript(params: ToastScriptParams): string {
  const { appId, toastXml } = params;
  const safeXml = toastXml.replace(/'/g, "''");
  const safeAppId = appId.replace(/'/g, "''");

  return `
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::InputEncoding  = New-Object System.Text.UTF8Encoding($false) } catch { }
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }

try {
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime]
    [void][Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime]

    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml('${safeXml}')

    $appId = '${safeAppId}'
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)

    $settingInt = $null
    try { $settingInt = [int]$notifier.Setting.value__ } catch { }
    if ($null -eq $settingInt) {
        try { $settingInt = [int]$notifier.Setting } catch { }
    }

    if ($null -ne $settingInt -and $settingInt -ne 0) {
        $reason = switch ($settingInt) {
            1 { 'DisabledForApplication' }
            2 { 'DisabledForUser' }
            3 { 'DisabledByGroupPolicy' }
            4 { 'DisabledByManifest' }
            default { "Unknown($settingInt)" }
        }
        Write-Output ('BLOCKED:' + $reason)
        exit 0
    }

    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    $notifier.Show($toast)
    Write-Output 'OK'
    exit 0
} catch {
    Write-Output ('ERROR:' + $_.Exception.Message)
    exit 0
}
`.trim();
}

export interface AumidRegisterParams {
  appId: string;
  appName: string;
  targetPath: string;
  iconPath: string;
  shortcutPath: string;
}

/**
 * Builds the PowerShell script that registers Claude Code's AUMID
 * (Application User Model ID) by creating a Start Menu shortcut and
 * tagging it with the AUMID via the IPropertyStore COM interface.
 *
 * Why this whole song-and-dance: Windows 10/11's
 * `ToastNotificationManager` refuses to display toasts unless the
 * calling process is associated with a registered AUMID. The cleanest
 * user-land way to register an AUMID without an installer or admin
 * rights is to drop a shortcut into the per-user Start Menu and stamp
 * it with the AUMID property. Once the shortcut exists, any process
 * launched from it (or invoking the AUMID directly) can show toasts.
 *
 * Why C# inline via `Add-Type` instead of pure PowerShell: PowerShell
 * has no clean way to call `SHGetPropertyStoreFromParsingName` and
 * marshal a `PROPVARIANT` of type `VT_LPWSTR`. Embedding a tiny C#
 * bridge keeps the marshaling correct and avoids depending on third-party
 * modules (which we cannot assume the user has installed).
 *
 * Magic numbers in the embedded C# (do not change without checking docs):
 *   - GUID `886d8eeb-8cf2-4446-8d02-cdba1dbdcf99`: IPropertyStore IID.
 *   - GUID `9f4c2855-9f79-4b39-a8d0-e1d42de1d5f3` + pid `5`:
 *     `PKEY_AppUserModel_ID` — the property that holds the AUMID.
 *     See https://learn.microsoft.com/windows/win32/properties/props-system-appusermodel-id
 *   - `vt = 31`: `VT_LPWSTR` — null-terminated UTF-16 string variant.
 *   - `flags = 2`: `GPS_READWRITE` for SHGetPropertyStoreFromParsingName.
 */
export function buildAumidRegisterScript(params: AumidRegisterParams): string {
  const { appId, appName, targetPath, iconPath, shortcutPath } = params;
  // PowerShell single-quote escape (same defense as buildToastScript above):
  // doubles every `'` so the value cannot terminate its string literal.
  const esc = (s: string) => s.replace(/'/g, "''");

  return `
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }

$AppId        = '${esc(appId)}'
$AppName      = '${esc(appName)}'
$TargetPath   = '${esc(targetPath)}'
$IconPath     = '${esc(iconPath)}'
$ShortcutPath = '${esc(shortcutPath)}'

if (-not (Test-Path $TargetPath)) {
    Write-Output ('ERROR:TARGET_NOT_FOUND:' + $TargetPath)
    exit 1
}

$shortcutDir = Split-Path $ShortcutPath -Parent
if (-not (Test-Path $shortcutDir)) {
    New-Item -ItemType Directory -Path $shortcutDir -Force | Out-Null
}

try {
    $wshell = New-Object -ComObject WScript.Shell
    $shortcut = $wshell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.IconLocation = $IconPath
    $shortcut.Description = $AppName
    $shortcut.WorkingDirectory = Split-Path $TargetPath -Parent
    $shortcut.Save()
} catch {
    Write-Output ('ERROR:SHORTCUT_FAILED:' + $_.Exception.Message)
    exit 1
}

$cs = @"
using System;
using System.Runtime.InteropServices;
namespace Ringly.Aumid {
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct PROPERTYKEY {
        public Guid fmtid;
        public uint pid;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct PROPVARIANT {
        public ushort vt;
        public ushort wReserved1;
        public ushort wReserved2;
        public ushort wReserved3;
        public IntPtr pwszVal;
        public IntPtr reserved2;
    }
    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99")]
    public interface IPropertyStore {
        void GetCount(out uint cProps);
        void GetAt(uint iProp, out PROPERTYKEY pkey);
        void GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
        void SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
        void Commit();
    }
    public static class Bridge {
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
        public static extern IPropertyStore SHGetPropertyStoreFromParsingName(
            [MarshalAs(UnmanagedType.LPWStr)] string pszPath,
            IntPtr zeroWorks,
            int flags,
            [In] ref Guid iIdPropStore);
        public static void SetAppId(string path, string aumid) {
            Guid storeId = new Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99");
            IPropertyStore store = SHGetPropertyStoreFromParsingName(path, IntPtr.Zero, 2, ref storeId);
            try {
                PROPERTYKEY key = new PROPERTYKEY();
                key.fmtid = new Guid("9f4c2855-9f79-4b39-a8d0-e1d42de1d5f3");
                key.pid = 5;
                PROPVARIANT pv = new PROPVARIANT();
                pv.vt = 31; // VT_LPWSTR
                pv.pwszVal = Marshal.StringToCoTaskMemUni(aumid);
                try {
                    store.SetValue(ref key, ref pv);
                    store.Commit();
                } finally {
                    Marshal.FreeCoTaskMem(pv.pwszVal);
                }
            } finally {
                if (store != null) Marshal.ReleaseComObject(store);
            }
        }
    }
}
"@

if (-not ('Ringly.Aumid.Bridge' -as [type])) {
    Add-Type -TypeDefinition $cs -Language CSharp -ReferencedAssemblies System.Runtime.InteropServices | Out-Null
}

try {
    [Ringly.Aumid.Bridge]::SetAppId($ShortcutPath, $AppId)
} catch {
    Write-Output ('ERROR:AUMID_FAILED:' + $_.Exception.Message)
    exit 1
}

try {
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime]
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId)
    Write-Output ('OK:' + $notifier.Setting)
} catch {
    Write-Output ('OK:UNKNOWN')
}

exit 0
`.trim();
}

export interface AumidQueryParams {
  shortcutPath: string;
}

export function buildAumidQueryScript(params: AumidQueryParams): string {
  const esc = (s: string) => s.replace(/'/g, "''");
  return `
$ErrorActionPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }

$ShortcutPath = '${esc(params.shortcutPath)}'
if (-not (Test-Path $ShortcutPath)) {
    Write-Output 'MISSING'
    exit 0
}

try {
    $matched = $null
    $apps = Get-StartApps -ErrorAction SilentlyContinue
    foreach ($app in $apps) {
        if ($app.Name -eq 'Claude Code') {
            $matched = $app.AppID
            break
        }
    }
    if ($matched) {
        Write-Output ('AUMID:' + $matched)
    } else {
        Write-Output 'EMPTY'
    }
} catch {
    Write-Output ('ERROR:' + $_.Exception.Message)
}

exit 0
`.trim();
}
