from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.create_collection_body_type_hint import CreateCollectionBodyTypeHint
from ..models.create_collection_body_visibility import CreateCollectionBodyVisibility
from ..types import UNSET, Unset

T = TypeVar("T", bound="CreateCollectionBody")


@_attrs_define
class CreateCollectionBody:
    """
    Attributes:
        name (str): Collection name
        description (str | Unset): Collection description
        visibility (CreateCollectionBodyVisibility | Unset): Visibility scope
        type_hint (CreateCollectionBodyTypeHint | Unset): Collection purpose
    """

    name: str
    description: str | Unset = UNSET
    visibility: CreateCollectionBodyVisibility | Unset = UNSET
    type_hint: CreateCollectionBodyTypeHint | Unset = UNSET
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
        field_dict.update(
            {
                "name": name,
            }
        )
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
        name = d.pop("name")

        description = d.pop("description", UNSET)

        _visibility = d.pop("visibility", UNSET)
        visibility: CreateCollectionBodyVisibility | Unset
        if isinstance(_visibility, Unset):
            visibility = UNSET
        else:
            visibility = CreateCollectionBodyVisibility(_visibility)

        _type_hint = d.pop("typeHint", UNSET)
        type_hint: CreateCollectionBodyTypeHint | Unset
        if isinstance(_type_hint, Unset):
            type_hint = UNSET
        else:
            type_hint = CreateCollectionBodyTypeHint(_type_hint)

        create_collection_body = cls(
            name=name,
            description=description,
            visibility=visibility,
            type_hint=type_hint,
        )

        create_collection_body.additional_properties = d
        return create_collection_body

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
