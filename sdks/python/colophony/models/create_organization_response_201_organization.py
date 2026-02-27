from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="CreateOrganizationResponse201Organization")



@_attrs_define
class CreateOrganizationResponse201Organization:
    """ 
        Attributes:
            id (UUID):
            name (str):
            slug (str):
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
            settings (Any | Unset):
     """

    id: UUID
    name: str
    slug: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    settings: Any | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        slug = self.slug

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        settings = self.settings


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "slug": slug,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })
        if settings is not UNSET:
            field_dict["settings"] = settings

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        slug = d.pop("slug")

        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        settings = d.pop("settings", UNSET)

        create_organization_response_201_organization = cls(
            id=id,
            name=name,
            slug=slug,
            created_at=created_at,
            updated_at=updated_at,
            settings=settings,
        )


        create_organization_response_201_organization.additional_properties = d
        return create_organization_response_201_organization

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
