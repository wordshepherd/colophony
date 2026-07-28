from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.list_organizations_response_200_item_roles_item import ListOrganizationsResponse200ItemRolesItem

T = TypeVar("T", bound="ListOrganizationsResponse200Item")


@_attrs_define
class ListOrganizationsResponse200Item:
    """
    Attributes:
        organization_id (UUID): ID of the organization
        name (str): Display name of the organization
        slug (str): URL-friendly identifier
        roles (list[ListOrganizationsResponse200ItemRolesItem]): Roles assigned to an organization member
    """

    organization_id: UUID
    name: str
    slug: str
    roles: list[ListOrganizationsResponse200ItemRolesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        organization_id = str(self.organization_id)

        name = self.name

        slug = self.slug

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "organizationId": organization_id,
                "name": name,
                "slug": slug,
                "roles": roles,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        organization_id = UUID(d.pop("organizationId"))

        name = d.pop("name")

        slug = d.pop("slug")

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in _roles:
            roles_item = ListOrganizationsResponse200ItemRolesItem(roles_item_data)

            roles.append(roles_item)

        list_organizations_response_200_item = cls(
            organization_id=organization_id,
            name=name,
            slug=slug,
            roles=roles,
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
