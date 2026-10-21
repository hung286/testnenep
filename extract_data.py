import sys, json, zipfile, datetime, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')

file_path = r'C:\Users\Admin\Downloads\TONG HOP THI DUA 2026-2027 (3).xlsx'
with zipfile.ZipFile(file_path, 'r') as z:
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        ss_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in ss_root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            t = ''.join([node.text for node in si.iter() if node.text])
            shared_strings.append(t)

    wb_xml = ET.fromstring(z.read('xl/workbook.xml'))
    sheets = wb_xml.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')
    rels_xml = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels_xml.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship')}

    weeks_summary = {}

    for s_idx in range(6):
        w_num = s_idx + 1
        target = 'xl/' + rel_map[sheets[s_idx].attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        s_xml = ET.fromstring(z.read(target))
        rows = s_xml.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
        
        date_title = ''
        for r in rows:
            r_num = int(r.attrib.get('r', 0))
            if r_num == 5:
                for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    if c.attrib.get('r') == 'A5':
                        v_tag = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                        if v_tag is not None:
                            date_title = shared_strings[int(v_tag.text)] if c.attrib.get('t') == 's' else v_tag.text

        classes_data = {}
        for r in rows:
            r_num = int(r.attrib.get('r', 0))
            if 9 <= r_num <= 37:
                cells = {}
                for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    ref = c.attrib.get('r')
                    col = ''.join([ch for ch in ref if ch.isalpha()])
                    t_type = c.attrib.get('t')
                    v_tag = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    val = ''
                    if v_tag is not None and v_tag.text:
                        val = shared_strings[int(v_tag.text)] if t_type == 's' else v_tag.text
                    cells[col] = val

                stt = cells.get('A', '')
                c_name = cells.get('B', '')
                gvcn = (cells.get('C', '') + ' ' + cells.get('D', '')).strip()

                def num(k):
                    v = cells.get(k, '').strip()
                    try:
                        return float(v) if v else 0.0
                    except:
                        return 0.0

                if w_num <= 2:
                    tot = num('E')
                    gioA = num('F')
                    gioB = num('G')
                    gioC = num('H')
                    gioD = num('I')
                    tongTiet = num('J')
                    diemTbHocTap = num('K')
                    viThuHocTap = int(num('L')) if num('L') else 1
                    diem15 = num('M')
                    diemTru = num('N')
                    tbNenNep = num('O')
                    viThuNenNep = int(num('P')) if num('P') else 1
                    hsVang = int(num('Q')) if num('Q') else 0
                    viThuVang = int(num('R')) if num('R') else 1
                    tbChung = num('S')
                    xepLoai = cells.get('T', '')
                    viThuChung = int(num('U')) if num('U') else 1
                    shl = 0.0
                else:
                    shl = num('E')
                    tot = num('F')
                    gioA = num('G')
                    gioB = num('H')
                    gioC = num('I')
                    gioD = num('J')
                    tongTiet = num('K')
                    diemTbHocTap = num('L')
                    viThuHocTap = int(num('M')) if num('M') else 1
                    diem15 = num('N')
                    diemTru = num('O')
                    tbNenNep = num('P')
                    viThuNenNep = int(num('Q')) if num('Q') else 1
                    hsVang = int(num('R')) if num('R') else 0
                    viThuVang = int(num('S')) if num('S') else 1
                    tbChung = num('T')
                    xepLoai = cells.get('U', '')
                    viThuChung = int(num('V')) if num('V') else 1

                classes_data[c_name] = {
                    'stt': int(stt) if stt.isdigit() else r_num-8,
                    'className': c_name,
                    'gvcn': gvcn,
                    'shl': shl,
                    'tot': tot,
                    'gioA': gioA,
                    'gioB': gioB,
                    'gioC': gioC,
                    'gioD': gioD,
                    'tongTiet': tongTiet,
                    'diemTbHocTap': round(diemTbHocTap, 3),
                    'viThuHocTap': viThuHocTap,
                    'diem15': diem15,
                    'diemTru': diemTru,
                    'tbNenNep': round(tbNenNep, 2),
                    'viThuNenNep': viThuNenNep,
                    'hsVang': hsVang,
                    'viThuVang': viThuVang,
                    'bonus': 0.0,
                    'tbChung': round(tbChung, 3),
                    'xepLoai': xepLoai,
                    'viThuChung': viThuChung
                }

        weeks_summary[w_num] = {
            'week': w_num,
            'locked': True,
            'dateTitle': date_title,
            'classes': classes_data
        }
        print(f'Week {w_num} parsed: {date_title}, {len(classes_data)} classes.')

    with open('data_locked_weeks.json', 'w', encoding='utf-8') as f:
        json.dump(weeks_summary, f, ensure_ascii=False, indent=2)
    print('Saved data_locked_weeks.json successfully!')
