; HabitGrid setup wizard (Inno Setup 6). Packs dist\HabitGrid.exe into dist\HabitGrid-Setup.exe:
;   iscc installer.iss        (build.bat runs this when Inno Setup is installed)
; It installs for the current user by default, so no administrator rights are needed.
; Uninstalling keeps the data in %APPDATA%\HabitGrid.

#define AppExe AddBackslash(SourcePath) + "dist\HabitGrid.exe"
#define AppVersion GetStringFileInfo(AppExe, "ProductVersion")

[Setup]
AppId={{8F3C2A51-6D4B-4E8A-9C7F-2B1D5E6A9F30}
AppName=HabitGrid
AppVersion={#AppVersion}
AppVerName=HabitGrid {#AppVersion}
AppPublisher=HabitGrid
AppPublisherURL=https://github.com/mayarakwad/HabitGrid
AppSupportURL=https://github.com/mayarakwad/HabitGrid/issues
AppUpdatesURL=https://github.com/mayarakwad/HabitGrid/releases
DefaultDirName={autopf}\HabitGrid
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=dist
OutputBaseFilename=HabitGrid-Setup
SetupIconFile=assets\icon.ico
UninstallDisplayIcon={app}\HabitGrid.exe
UninstallDisplayName=HabitGrid
VersionInfoVersion={#AppVersion}
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
; main.py holds this while HabitGrid runs, so Setup can ask to close it before updating.
AppMutex=HabitGrid.Running
CloseApplications=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "dist\HabitGrid.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\HabitGrid"; Filename: "{app}\HabitGrid.exe"
Name: "{autodesktop}\HabitGrid"; Filename: "{app}\HabitGrid.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\HabitGrid.exe"; Description: "{cm:LaunchProgram,HabitGrid}"; Flags: nowait postinstall skipifsilent
