from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.add_organization_member_response_201_type_0_member import AddOrganizationMemberResponse201Type0Member


T = TypeVar("T", bound="AddOrganizationMemberResponse201Type0")


@_attrs_define
class AddOrganizationMemberResponse201Type0:
    """
    Attributes:
        type_ (Literal['member_added']):
        member (AddOrganizationMemberResponse201Type0Member):
    """

    type_: Literal["member_added"]
    member: AddOrganizationMemberResponse201Type0Member
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        member = self.member.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
                "member": member,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.add_organization_member_response_201_type_0_member import (
            AddOrganizationMemberResponse201Type0Member,
        )

        d = dict(src_dict)
        type_ = cast(Literal["member_added"], d.pop("type"))
        if type_ != "member_added":
            raise ValueError(f"type must match const 'member_added', got '{type_}'")

        member = AddOrganizationMemberResponse201Type0Member.from_dict(d.pop("member"))

        add_organization_member_response_201_type_0 = cls(
            type_=type_,
            member=member,
        )

        add_organization_member_response_201_type_0.additional_properties = d
        return add_organization_member_response_201_type_0

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
