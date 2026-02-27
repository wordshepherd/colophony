from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.add_organization_member_response_201_role import AddOrganizationMemberResponse201Role
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="AddOrganizationMemberResponse201")



@_attrs_define
class AddOrganizationMemberResponse201:
    """ 
        Attributes:
            id (UUID): Membership record ID
            organization_id (UUID): ID of the organization
            user_id (UUID): ID of the member user
            role (AddOrganizationMemberResponse201Role): Member role within an organization
            created_at (datetime.datetime): When the membership was created
            updated_at (datetime.datetime): When the membership was last updated
     """

    id: UUID
    organization_id: UUID
    user_id: UUID
    role: AddOrganizationMemberResponse201Role
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        organization_id = str(self.organization_id)

        user_id = str(self.user_id)

        role = self.role.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "userId": user_id,
            "role": role,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        user_id = UUID(d.pop("userId"))




        role = AddOrganizationMemberResponse201Role(d.pop("role"))




        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        add_organization_member_response_201 = cls(
            id=id,
            organization_id=organization_id,
            user_id=user_id,
            role=role,
            created_at=created_at,
            updated_at=updated_at,
        )


        add_organization_member_response_201.additional_properties = d
        return add_organization_member_response_201

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
