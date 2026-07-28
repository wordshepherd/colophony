from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ExportCsrResponse200WriterProfilesItem")


@_attrs_define
class ExportCsrResponse200WriterProfilesItem:
    """External platform profile link

    Attributes:
        id (UUID):
        platform (str):
        external_id (None | str):
        profile_url (None | str):
    """

    id: UUID
    platform: str
    external_id: None | str
    profile_url: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        platform = self.platform

        external_id: None | str
        external_id = self.external_id

        profile_url: None | str
        profile_url = self.profile_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "platform": platform,
                "externalId": external_id,
                "profileUrl": profile_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        platform = d.pop("platform")

        def _parse_external_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        external_id = _parse_external_id(d.pop("externalId"))

        def _parse_profile_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        profile_url = _parse_profile_url(d.pop("profileUrl"))

        export_csr_response_200_writer_profiles_item = cls(
            id=id,
            platform=platform,
            external_id=external_id,
            profile_url=profile_url,
        )

        export_csr_response_200_writer_profiles_item.additional_properties = d
        return export_csr_response_200_writer_profiles_item

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
