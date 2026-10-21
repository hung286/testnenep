with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'const regex = new RegExp' in line:
        lines[i] = "        const regex = new RegExp('(?:^|\\\\s)' + c + '[:\\\\s\\\\+]+([0-9]+(?:\\\\.[0-9]+)?)(?:\\\\s*\\\\((.*?)\\\\))?', 'i');\n"
        print(f"Fixed line {i+1}: {lines[i]}")

with open('app.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
