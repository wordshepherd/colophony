from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.create_organization_response_201_membership import CreateOrganizationResponse201Membership
  from ..models.create_organization_response_201_organization import CreateOrganizationResponse201Organization





T = TypeVar("T", bound="CreateOrganizationResponse201")



@_attrs_define
class CreateOrganizationResponse201:
    """ 
        Attributes:
            organization (CreateOrganizationResponse201Organization):
            membership (CreateOrganizationResponse201Membership):
     """

    organization: CreateOrganizationResponse201Organization
    membership: CreateOrganizationResponse201Membership
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_organization_response_201_organization import CreateOrganizationResponse201Organization
        from ..models.create_organization_response_201_membership import CreateOrganizationResponse201Membership
        organization = self.organization.to_dict()

        membership = self.membership.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "organization": organization,
            "membership": membership,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_organization_response_201_membership import CreateOrganizationResponse201Membership
        from ..models.create_organization_response_201_organization import CreateOrganizationResponse201Organization
        d = dict(src_dict)
        organization = CreateOrganizationResponse201Organization.from_dict(d.pop("organization"))




        membership = CreateOrganizationResponse201Membership.from_dict(d.pop("membership"))




        create_organization_response_201 = cls(
            organization=organization,
            membership=membership,
        )


        create_organization_response_201.additional_properties = d
        return create_organization_response_201

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
