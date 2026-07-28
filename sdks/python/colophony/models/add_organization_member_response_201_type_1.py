from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.add_organization_member_response_201_type_1_invitation import (
        AddOrganizationMemberResponse201Type1Invitation,
    )


T = TypeVar("T", bound="AddOrganizationMemberResponse201Type1")


@_attrs_define
class AddOrganizationMemberResponse201Type1:
    """
    Attributes:
        type_ (Literal['invitation_sent']):
        invitation (AddOrganizationMemberResponse201Type1Invitation):
    """

    type_: Literal["invitation_sent"]
    invitation: AddOrganizationMemberResponse201Type1Invitation
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        invitation = self.invitation.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
                "invitation": invitation,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.add_organization_member_response_201_type_1_invitation import (
            AddOrganizationMemberResponse201Type1Invitation,
        )

        d = dict(src_dict)
        type_ = cast(Literal["invitation_sent"], d.pop("type"))
        if type_ != "invitation_sent":
            raise ValueError(f"type must match const 'invitation_sent', got '{type_}'")

        invitation = AddOrganizationMemberResponse201Type1Invitation.from_dict(d.pop("invitation"))

        add_organization_member_response_201_type_1 = cls(
            type_=type_,
            invitation=invitation,
        )

        add_organization_member_response_201_type_1.additional_properties = d
        return add_organization_member_response_201_type_1

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
