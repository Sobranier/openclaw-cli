Output assets/demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 900
Set Height 500
Set Theme "Catppuccin Mocha"
Set Padding 20

# Show the tool
Type "openclaw-doctor status" Sleep 500ms Enter
Sleep 3s

# Start background monitoring
Type "openclaw-doctor watch -d" Sleep 500ms Enter
Sleep 3s

# Check again to show it's running
Type "openclaw-doctor status" Sleep 500ms Enter
Sleep 3s

# Show logs
Type "openclaw-doctor logs --doctor" Sleep 500ms Enter
Sleep 3s

# Stop
Type "openclaw-doctor unwatch" Sleep 500ms Enter
Sleep 2s
