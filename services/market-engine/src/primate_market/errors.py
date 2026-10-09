"""Error codes shared with the web client. The code is what the API returns; the page maps it to copy."""


class MarketError(Exception):
    """A rule refused the operation. Nothing changed."""

    def __init__(self, code: str, **details: object) -> None:
        super().__init__(code)
        self.code = code
        self.details = details

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"MarketError({self.code!r}, {self.details!r})"
