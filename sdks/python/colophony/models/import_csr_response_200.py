from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="ImportCsrResponse200")


@_attrs_define
class ImportCsrResponse200:
    """
    Attributes:
        submissions_created (int):
        correspondence_created (int):
    """

    submissions_created: int
    correspondence_created: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        submissions_created = self.submissions_created

        correspondence_created = self.correspondence_created

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "submissionsCreated": submissions_created,
                "correspondenceCreated": correspondence_created,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        submissions_created = d.pop("submissionsCreated")

        correspondence_created = d.pop("correspondenceCreated")

        import_csr_response_200 = cls(
            submissions_created=submissions_created,
            correspondence_created=correspondence_created,
        )

        import_csr_response_200.additional_properties = d
        return import_csr_response_200

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
