from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.add_organization_member_body_role import AddOrganizationMemberBodyRole






T = TypeVar("T", bound="AddOrganizationMemberBody")



@_attrs_define
class AddOrganizationMemberBody:
    """ 
        Attributes:
            email (str): Email address of the user to invite
            role (AddOrganizationMemberBodyRole): Role to assign to the new member
     """

    email: str
    role: AddOrganizationMemberBodyRole
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        email = self.email

        role = self.role.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "email": email,
            "role": role,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email = d.pop("email")

        role = AddOrganizationMemberBodyRole(d.pop("role"))




        add_organization_member_body = cls(
            email=email,
            role=role,
        )


        add_organization_member_body.additional_properties = d
        return add_organization_member_body

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
