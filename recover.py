import os

content = open('original_page.tsx.txt', 'r', encoding='utf-8').read()

targets = {
    'apps/dashboard/app/page.tsx': {},
    'apps/dashboard/app/needs-approval/page.tsx': {},
    'apps/dashboard/app/campaigns/page.tsx': {},
    'apps/dashboard/app/reports/page.tsx': {},
    'apps/dashboard/app/settings/page.tsx': {},
}

blocks = content.split('==================================================')
for block in blocks:
    if not block.strip(): continue
    lines = block.strip().split('\n')
    
    file_path = None
    for line in lines:
        if line.startswith('File Path:'):
            parts = line.split('`')
            if len(parts) >= 3:
                path = parts[1]
                prefix = 'file:///c:/Users/ASUS/OneDrive/Desktop/AIAutomationLeadProject/'
                if path.startswith(prefix):
                    file_path = path[len(prefix):]
            break
            
    if file_path in targets:
        for line in lines:
            if ':' in line:
                parts = line.split(':', 1)
                if parts[0].isdigit():
                    lineno = int(parts[0])
                    code = parts[1]
                    if code.startswith(' '):
                        code = code[1:]
                    if code.endswith('\r'):
                        code = code[:-1]
                    targets[file_path][lineno] = code

os.makedirs('recovered', exist_ok=True)
for file_path, lines_dict in targets.items():
    if not lines_dict: continue
    
    max_line = max(lines_dict.keys())
    out_lines = []
    for i in range(1, max_line + 1):
        out_lines.append(lines_dict.get(i, ''))
        
    out_path = 'recovered/' + file_path.replace('/', '_')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out_lines) + '\n')
    
    print(f'Recovered {file_path} to {out_path} ({len(out_lines)} lines)')
