from __future__ import annotations


class DaaError(Exception):
    pass


class DaaParseError(DaaError):
    pass


class DaaAuthError(DaaError):
    pass
