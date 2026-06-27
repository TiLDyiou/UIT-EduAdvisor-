import json
from app.services.daa.parser import parse_ics_schedule
with open("/home/tildy/Documents/UIT-EduAdvisor-/docs/24520245_scheduled.ics", "rb") as f:
    ics_text = f.read()
rows = parse_ics_schedule(ics_text)
print(json.dumps(rows, indent=2))
