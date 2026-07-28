from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="AddCollectionItemBody")


@_attrs_define
class AddCollectionItemBody:
    """
    Attributes:
        submission_id (UUID): Submission to add
        position (int | Unset): Sort position
        notes (str | Unset): Private notes
        color (str | Unset): Label color
        icon (str | Unset): Item icon
    """

    submission_id: UUID
    position: int | Unset = UNSET
    notes: str | Unset = UNSET
    color: str | Unset = UNSET
    icon: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        submission_id = str(self.submission_id)

        position = self.position

        notes = self.notes

        color = self.color

        icon = self.icon

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "submissionId": submission_id,
            }
        )
        if position is not UNSET:
            field_dict["position"] = position
        if notes is not UNSET:
            field_dict["notes"] = notes
        if color is not UNSET:
            field_dict["color"] = color
        if icon is not UNSET:
            field_dict["icon"] = icon

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        submission_id = UUID(d.pop("submissionId"))

        position = d.pop("position", UNSET)

        notes = d.pop("notes", UNSET)

        color = d.pop("color", UNSET)

        icon = d.pop("icon", UNSET)

        add_collection_item_body = cls(
            submission_id=submission_id,
            position=position,
            notes=notes,
            color=color,
            icon=icon,
        )

        add_collection_item_body.additional_properties = d
        return add_collection_item_body

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
