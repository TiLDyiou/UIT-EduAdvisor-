import re

def parse_class_code_info(val: str):
    m = re.match(r"^([a-zđ]+)(\d{4})", val, re.I)
    if m:
        prefix = m.group(1).upper()
        year_str = m.group(2)
        return prefix, int(year_str)
    return None, None

print(parse_class_code_info("ATTT2024.1"))
