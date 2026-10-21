import sys, json, zipfile, datetime, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')

fpath = r'C:\Users\Admin\Downloads\HS VPNN 2026-2027.xlsx'
with zipfile.ZipFile(fpath, 'r') as z:
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

    base_date = datetime.date(1899, 12, 30)

    all_v = []
    v_id = 1
    for s in sheets:
        w_name = s.attrib['name'] # '1', '2', '4', '5'
        target = 'xl/' + rel_map[s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
        s_xml = ET.fromstring(z.read(target))
        rows = s_xml.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
        for r in rows:
            r_num = int(r.attrib.get('r', 0))
            if r_num >= 7:
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

                stt = cells.get('A', '').strip()
                c_name = cells.get('B', '').strip()
                name = cells.get('C', '').strip()
                gender = cells.get('D', '').strip()
                date_val = cells.get('E', '').strip()
                rule = cells.get('F', '').strip()
                points = cells.get('G', '').strip()

                if c_name and rule:
                    date_str = ''
                    try:
                        if date_val.isdigit():
                            d = base_date + datetime.timedelta(days=int(date_val))
                            date_str = d.strftime('%Y-%m-%d')
                    except Exception:
                        pass

                    all_v.append({
                        'id': v_id,
                        'week': int(w_name) if w_name.isdigit() else 1,
                        'date': date_str,
                        'student_name': name,
                        'class_name': c_name,
                        'gender': gender,
                        'violation_category': rule,
                        'penalty_points': float(points) if points else 0.5,
                        'original_note': f'{rule} ({name} - {c_name})'
                    })
                    v_id += 1

    # Load existing week 7 violations from data_violations.json
    try:
        with open('data_violations.json', 'r', encoding='utf-8') as f:
            w7_v = json.load(f)
            for item in w7_v:
                item['id'] = v_id
                v_id += 1
                all_v.append(item)
    except Exception as e:
        print('Error reading data_violations.json:', e)

    with open('data_violations.json', 'w', encoding='utf-8') as f:
        json.dump(all_v, f, ensure_ascii=False, indent=2)
    print(f'Saved {len(all_v)} total violations to data_violations.json!')
