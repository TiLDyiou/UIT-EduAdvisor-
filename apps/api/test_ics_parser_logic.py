def parse_ics_schedule(ics_text: str) -> list[dict]:
    import icalendar
    import re
    cal = icalendar.Calendar.from_ical(ics_text.encode('utf-8') if isinstance(ics_text, str) else ics_text)
    out = []
    
    day_map = {'MO': 2, 'TU': 3, 'WE': 4, 'TH': 5, 'FR': 6, 'SA': 7, 'SU': 8}
    
    for component in cal.walk():
        if component.name == "VEVENT":
            summary = str(component.get('summary', ''))
            description = str(component.get('description', ''))
            
            # extract course code from summary: "IT007.Q210 - P. B3.16" -> "IT007.Q210"
            course_code = summary.split(' - ')[0].strip()
            
            # extract course name from description: "Lớp: IT007.Q210(Hệ điều hành) - ..." -> "Hệ điều hành"
            course_name = course_code
            name_match = re.search(r'\((.*?)\)', description)
            if name_match:
                course_name = name_match.group(1)
                
            # extract day of week from rrule
            rrule = component.get('rrule')
            day_of_week = 2
            if rrule and 'BYDAY' in rrule:
                byday = rrule['BYDAY'][0]
                day_of_week = day_map.get(byday, 2)
                
            # extract periods from description: "Tiết 12345" -> 1 and 5
            start_p = 1
            end_p = 1
            period_match = re.search(r'Tiết\s+(\d+)', description)
            if period_match:
                periods = period_match.group(1)
                start_p = int(periods[0])
                # handle Tiết 67890 (0 means 10)
                if periods[-1] == '0':
                    end_p = 10
                else:
                    end_p = int(periods[-1])
                    
            room = summary.split('- P. ')[-1].strip() if '- P. ' in summary else None
            
            # extract frequency info from description: "Cách 2 tuần"
            week_pattern = "Hàng tuần"
            if "Cách" in description:
                freq_match = re.search(r'Cách\s+\d+\s+tuần', description)
                if freq_match:
                    week_pattern = freq_match.group(0)
                    
            out.append({
                "course_code": course_code,
                "course_name": course_name,
                "day_of_week": day_of_week,
                "start_period": start_p,
                "end_period": end_p,
                "room": room,
                "week_pattern": week_pattern,
            })
            
    return out
with open("../../docs/24520245_scheduled.ics", "r") as f:
    text = f.read()
    res = parse_ics_schedule(text)
    for r in res:
        print(r)
