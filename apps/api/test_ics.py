import icalendar
from datetime import datetime

with open("../../docs/24520245_scheduled.ics", "rb") as f:
    cal = icalendar.Calendar.from_ical(f.read())

for component in cal.walk():
    if component.name == "VEVENT":
        summary = str(component.get('summary'))
        description = str(component.get('description'))
        dtstart = component.get('dtstart').dt
        rrule = component.get('rrule')
        
        print("SUMMARY:", summary)
        print("DESC:", description)
        print("DTSTART:", dtstart)
        print("RRULE:", rrule)
        print("-" * 40)
