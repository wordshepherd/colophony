from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.export_csr_response_200_manuscripts_item_genre_type_0_hybrid_item import (
    ExportCsrResponse200ManuscriptsItemGenreType0HybridItem,
)
from ..models.export_csr_response_200_manuscripts_item_genre_type_0_primary import (
    ExportCsrResponse200ManuscriptsItemGenreType0Primary,
)

T = TypeVar("T", bound="ExportCsrResponse200ManuscriptsItemGenreType0")


@_attrs_define
class ExportCsrResponse200ManuscriptsItemGenreType0:
    """Structured genre classification with hybrid support

    Attributes:
        primary (ExportCsrResponse200ManuscriptsItemGenreType0Primary): Primary genre classification
        sub (None | str): Freetext subgenre (e.g., 'flash', 'lyric essay')
        hybrid (list[ExportCsrResponse200ManuscriptsItemGenreType0HybridItem]): Additional primary genres for hybrid
            work
    """

    primary: ExportCsrResponse200ManuscriptsItemGenreType0Primary
    sub: None | str
    hybrid: list[ExportCsrResponse200ManuscriptsItemGenreType0HybridItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        primary = self.primary.value

        sub: None | str
        sub = self.sub

        hybrid = []
        for hybrid_item_data in self.hybrid:
            hybrid_item = hybrid_item_data.value
            hybrid.append(hybrid_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "primary": primary,
                "sub": sub,
                "hybrid": hybrid,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        primary = ExportCsrResponse200ManuscriptsItemGenreType0Primary(d.pop("primary"))

        def _parse_sub(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        sub = _parse_sub(d.pop("sub"))

        hybrid = []
        _hybrid = d.pop("hybrid")
        for hybrid_item_data in _hybrid:
            hybrid_item = ExportCsrResponse200ManuscriptsItemGenreType0HybridItem(hybrid_item_data)

            hybrid.append(hybrid_item)

        export_csr_response_200_manuscripts_item_genre_type_0 = cls(
            primary=primary,
            sub=sub,
            hybrid=hybrid,
        )

        export_csr_response_200_manuscripts_item_genre_type_0.additional_properties = d
        return export_csr_response_200_manuscripts_item_genre_type_0

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
