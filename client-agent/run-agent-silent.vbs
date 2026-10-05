Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File ""C:\NHSO-Agent\nhso-agent.ps1""", 0, False
Set WshShell = Nothing
