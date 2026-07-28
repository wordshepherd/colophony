from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="UpdateCollectionItemResponse200")


@_attrs_define
class UpdateCollectionItemResponse200:
    """
    Attributes:
        id (UUID): Item ID
        collection_id (UUID): Collection ID
        submission_id (UUID): Submission ID
        position (int): Sort position within collection
        notes (None | str): Private editor notes
        color (None | str): Label color
        icon (None | str): Item icon
        added_at (datetime.datetime): When the item was added
        touched_at (datetime.datetime): When the item was last touched
        reading_anchor (Any | None | Unset): Reading position anchor (deferred)
        submission_title (None | str | Unset):
    """

    id: UUID
    collection_id: UUID
    submission_id: UUID
    position: int
    notes: None | str
    color: None | str
    icon: None | str
    added_at: datetime.datetime
    touched_at: datetime.datetime
    reading_anchor: Any | None | Unset = UNSET
    submission_title: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        collection_id = str(self.collection_id)

        submission_id = str(self.submission_id)

        position = self.position

        notes: None | str
        notes = self.notes

        color: None | str
        color = self.color

        icon: None | str
        icon = self.icon

        added_at = self.added_at.isoformat()

        touched_at = self.touched_at.isoformat()

        reading_anchor: Any | None | Unset
        if isinstance(self.reading_anchor, Unset):
            reading_anchor = UNSET
        else:
            reading_anchor = self.reading_anchor

        submission_title: None | str | Unset
        if isinstance(self.submission_title, Unset):
            submission_title = UNSET
        else:
            submission_title = self.submission_title

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "collectionId": collection_id,
                "submissionId": submission_id,
                "position": position,
                "notes": notes,
                "color": color,
                "icon": icon,
                "addedAt": added_at,
                "touchedAt": touched_at,
            }
        )
        if reading_anchor is not UNSET:
            field_dict["readingAnchor"] = reading_anchor
        if submission_title is not UNSET:
            field_dict["submissionTitle"] = submission_title

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        collection_id = UUID(d.pop("collectionId"))

        submission_id = UUID(d.pop("submissionId"))

        position = d.pop("position")

        def _parse_notes(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        notes = _parse_notes(d.pop("notes"))

        def _parse_color(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        color = _parse_color(d.pop("color"))

        def _parse_icon(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        icon = _parse_icon(d.pop("icon"))

        added_at = datetime.datetime.fromisoformat(d.pop("addedAt"))

        touched_at = datetime.datetime.fromisoformat(d.pop("touchedAt"))

        def _parse_reading_anchor(data: object) -> Any | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(Any | None | Unset, data)

        reading_anchor = _parse_reading_anchor(d.pop("readingAnchor", UNSET))

        def _parse_submission_title(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        submission_title = _parse_submission_title(d.pop("submissionTitle", UNSET))

        update_collection_item_response_200 = cls(
            id=id,
            collection_id=collection_id,
            submission_id=submission_id,
            position=position,
            notes=notes,
            color=color,
            icon=icon,
            added_at=added_at,
            touched_at=touched_at,
            reading_anchor=reading_anchor,
            submission_title=submission_title,
        )

        update_collection_item_response_200.additional_properties = d
        return update_collection_item_response_200

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
