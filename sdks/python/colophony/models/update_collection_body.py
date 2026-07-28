from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.update_collection_body_type_hint import UpdateCollectionBodyTypeHint
from ..models.update_collection_body_visibility import UpdateCollectionBodyVisibility
from ..types import UNSET, Unset

T = TypeVar("T", bound="UpdateCollectionBody")


@_attrs_define
class UpdateCollectionBody:
    """
    Attributes:
        name (str | Unset): Collection name
        description (str | Unset): Collection description
        visibility (UpdateCollectionBodyVisibility | Unset): Visibility scope
        type_hint (UpdateCollectionBodyTypeHint | Unset): Collection purpose
    """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    visibility: UpdateCollectionBodyVisibility | Unset = UNSET
    type_hint: UpdateCollectionBodyTypeHint | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        visibility: str | Unset = UNSET
        if not isinstance(self.visibility, Unset):
            visibility = self.visibility.value

        type_hint: str | Unset = UNSET
        if not isinstance(self.type_hint, Unset):
            type_hint = self.type_hint.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if visibility is not UNSET:
            field_dict["visibility"] = visibility
        if type_hint is not UNSET:
            field_dict["typeHint"] = type_hint

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        _visibility = d.pop("visibility", UNSET)
        visibility: UpdateCollectionBodyVisibility | Unset
        if isinstance(_visibility, Unset):
            visibility = UNSET
        else:
            visibility = UpdateCollectionBodyVisibility(_visibility)

        _type_hint = d.pop("typeHint", UNSET)
        type_hint: UpdateCollectionBodyTypeHint | Unset
        if isinstance(_type_hint, Unset):
            type_hint = UNSET
        else:
            type_hint = UpdateCollectionBodyTypeHint(_type_hint)

        update_collection_body = cls(
            name=name,
            description=description,
            visibility=visibility,
            type_hint=type_hint,
        )

        update_collection_body.additional_properties = d
        return update_collection_body

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
