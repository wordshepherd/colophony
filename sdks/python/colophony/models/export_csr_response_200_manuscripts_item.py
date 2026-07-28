from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.export_csr_response_200_manuscripts_item_genre_type_0 import (
        ExportCsrResponse200ManuscriptsItemGenreType0,
    )


T = TypeVar("T", bound="ExportCsrResponse200ManuscriptsItem")


@_attrs_define
class ExportCsrResponse200ManuscriptsItem:
    """
    Attributes:
        id (UUID):
        title (None | str):
        genre (ExportCsrResponse200ManuscriptsItemGenreType0 | None):
        created_at (datetime.datetime):
    """

    id: UUID
    title: None | str
    genre: ExportCsrResponse200ManuscriptsItemGenreType0 | None
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.export_csr_response_200_manuscripts_item_genre_type_0 import (
            ExportCsrResponse200ManuscriptsItemGenreType0,
        )

        id = str(self.id)

        title: None | str
        title = self.title

        genre: dict[str, Any] | None
        if isinstance(self.genre, ExportCsrResponse200ManuscriptsItemGenreType0):
            genre = self.genre.to_dict()
        else:
            genre = self.genre

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "title": title,
                "genre": genre,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.export_csr_response_200_manuscripts_item_genre_type_0 import (
            ExportCsrResponse200ManuscriptsItemGenreType0,
        )

        d = dict(src_dict)
        id = UUID(d.pop("id"))

        def _parse_title(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        title = _parse_title(d.pop("title"))

        def _parse_genre(data: object) -> ExportCsrResponse200ManuscriptsItemGenreType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                genre_type_0 = ExportCsrResponse200ManuscriptsItemGenreType0.from_dict(data)

                return genre_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ExportCsrResponse200ManuscriptsItemGenreType0 | None, data)

        genre = _parse_genre(d.pop("genre"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        export_csr_response_200_manuscripts_item = cls(
            id=id,
            title=title,
            genre=genre,
            created_at=created_at,
        )

        export_csr_response_200_manuscripts_item.additional_properties = d
        return export_csr_response_200_manuscripts_item

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
