from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_organizations_response_200_item_role import ListOrganizationsResponse200ItemRole
from uuid import UUID






T = TypeVar("T", bound="ListOrganizationsResponse200Item")



@_attrs_define
class ListOrganizationsResponse200Item:
    """ 
        Attributes:
            organization_id (UUID): ID of the organization
            name (str): Display name of the organization
            slug (str): URL-friendly identifier
            role (ListOrganizationsResponse200ItemRole): Member role within an organization
     """

    organization_id: UUID
    name: str
    slug: str
    role: ListOrganizationsResponse200ItemRole
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        organization_id = str(self.organization_id)

        name = self.name

        slug = self.slug

        role = self.role.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "organizationId": organization_id,
            "name": name,
            "slug": slug,
            "role": role,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        organization_id = UUID(d.pop("organizationId"))




        name = d.pop("name")

        slug = d.pop("slug")

        role = ListOrganizationsResponse200ItemRole(d.pop("role"))




        list_organizations_response_200_item = cls(
            organization_id=organization_id,
            name=name,
            slug=slug,
            role=role,
        )


        list_organizations_response_200_item.additional_properties = d
        return list_organizations_response_200_item

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
