import secrets
import random
from django.core.cache import cache

_DIGIT_MAP = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
CAPTCHA_TTL = 300


def new_math_captcha():
    a = random.randint(1, 9)
    b = random.randint(1, 9)
    op = random.choice(["+", "-"])

    if op == "-" and b > a:
        a, b = b, a  # avoid negatives

    answer = str(a + b) if op == "+" else str(a - b)
    question = f"{a} {op} {b} = ?"

    key = secrets.token_urlsafe(16)
    cache.set(f"captcha:{key}", answer, timeout=CAPTCHA_TTL)
    return key, question


def verify_simple_captcha(captcha_key: str, captcha_value: str) -> bool:
    if not captcha_key or not captcha_value:
        return False

    value = captcha_value.strip().translate(_DIGIT_MAP)
    cache_key = f"captcha:{captcha_key}"

    expected = cache.get(cache_key)
    cache.delete(cache_key)  # single-use whether correct or not

    return expected is not None and expected == value
