from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.export_csr_response_200_correspondence_item import ExportCsrResponse200CorrespondenceItem
    from ..models.export_csr_response_200_external_submissions_item import ExportCsrResponse200ExternalSubmissionsItem
    from ..models.export_csr_response_200_identity import ExportCsrResponse200Identity
    from ..models.export_csr_response_200_manuscripts_item import ExportCsrResponse200ManuscriptsItem
    from ..models.export_csr_response_200_native_submissions_item import ExportCsrResponse200NativeSubmissionsItem
    from ..models.export_csr_response_200_writer_profiles_item import ExportCsrResponse200WriterProfilesItem


T = TypeVar("T", bound="ExportCsrResponse200")


@_attrs_define
class ExportCsrResponse200:
    """Full CSR export envelope — personal data portability

    Attributes:
        version (Literal['1.0']):
        exported_at (datetime.datetime):
        identity (ExportCsrResponse200Identity):
        native_submissions (list[ExportCsrResponse200NativeSubmissionsItem]):
        external_submissions (list[ExportCsrResponse200ExternalSubmissionsItem]):
        correspondence (list[ExportCsrResponse200CorrespondenceItem]):
        writer_profiles (list[ExportCsrResponse200WriterProfilesItem]):
        manuscripts (list[ExportCsrResponse200ManuscriptsItem]):
    """

    version: Literal["1.0"]
    exported_at: datetime.datetime
    identity: ExportCsrResponse200Identity
    native_submissions: list[ExportCsrResponse200NativeSubmissionsItem]
    external_submissions: list[ExportCsrResponse200ExternalSubmissionsItem]
    correspondence: list[ExportCsrResponse200CorrespondenceItem]
    writer_profiles: list[ExportCsrResponse200WriterProfilesItem]
    manuscripts: list[ExportCsrResponse200ManuscriptsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        version = self.version

        exported_at = self.exported_at.isoformat()

        identity = self.identity.to_dict()

        native_submissions = []
        for native_submissions_item_data in self.native_submissions:
            native_submissions_item = native_submissions_item_data.to_dict()
            native_submissions.append(native_submissions_item)

        external_submissions = []
        for external_submissions_item_data in self.external_submissions:
            external_submissions_item = external_submissions_item_data.to_dict()
            external_submissions.append(external_submissions_item)

        correspondence = []
        for correspondence_item_data in self.correspondence:
            correspondence_item = correspondence_item_data.to_dict()
            correspondence.append(correspondence_item)

        writer_profiles = []
        for writer_profiles_item_data in self.writer_profiles:
            writer_profiles_item = writer_profiles_item_data.to_dict()
            writer_profiles.append(writer_profiles_item)

        manuscripts = []
        for manuscripts_item_data in self.manuscripts:
            manuscripts_item = manuscripts_item_data.to_dict()
            manuscripts.append(manuscripts_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "version": version,
                "exportedAt": exported_at,
                "identity": identity,
                "nativeSubmissions": native_submissions,
                "externalSubmissions": external_submissions,
                "correspondence": correspondence,
                "writerProfiles": writer_profiles,
                "manuscripts": manuscripts,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.export_csr_response_200_correspondence_item import ExportCsrResponse200CorrespondenceItem
        from ..models.export_csr_response_200_external_submissions_item import (
            ExportCsrResponse200ExternalSubmissionsItem,
        )
        from ..models.export_csr_response_200_identity import ExportCsrResponse200Identity
        from ..models.export_csr_response_200_manuscripts_item import ExportCsrResponse200ManuscriptsItem
        from ..models.export_csr_response_200_native_submissions_item import ExportCsrResponse200NativeSubmissionsItem
        from ..models.export_csr_response_200_writer_profiles_item import ExportCsrResponse200WriterProfilesItem

        d = dict(src_dict)
        version = cast(Literal["1.0"], d.pop("version"))
        if version != "1.0":
            raise ValueError(f"version must match const '1.0', got '{version}'")

        exported_at = datetime.datetime.fromisoformat(d.pop("exportedAt"))

        identity = ExportCsrResponse200Identity.from_dict(d.pop("identity"))

        native_submissions = []
        _native_submissions = d.pop("nativeSubmissions")
        for native_submissions_item_data in _native_submissions:
            native_submissions_item = ExportCsrResponse200NativeSubmissionsItem.from_dict(native_submissions_item_data)

            native_submissions.append(native_submissions_item)

        external_submissions = []
        _external_submissions = d.pop("externalSubmissions")
        for external_submissions_item_data in _external_submissions:
            external_submissions_item = ExportCsrResponse200ExternalSubmissionsItem.from_dict(
                external_submissions_item_data
            )

            external_submissions.append(external_submissions_item)

        correspondence = []
        _correspondence = d.pop("correspondence")
        for correspondence_item_data in _correspondence:
            correspondence_item = ExportCsrResponse200CorrespondenceItem.from_dict(correspondence_item_data)

            correspondence.append(correspondence_item)

        writer_profiles = []
        _writer_profiles = d.pop("writerProfiles")
        for writer_profiles_item_data in _writer_profiles:
            writer_profiles_item = ExportCsrResponse200WriterProfilesItem.from_dict(writer_profiles_item_data)

            writer_profiles.append(writer_profiles_item)

        manuscripts = []
        _manuscripts = d.pop("manuscripts")
        for manuscripts_item_data in _manuscripts:
            manuscripts_item = ExportCsrResponse200ManuscriptsItem.from_dict(manuscripts_item_data)

            manuscripts.append(manuscripts_item)

        export_csr_response_200 = cls(
            version=version,
            exported_at=exported_at,
            identity=identity,
            native_submissions=native_submissions,
            external_submissions=external_submissions,
            correspondence=correspondence,
            writer_profiles=writer_profiles,
            manuscripts=manuscripts,
        )

        export_csr_response_200.additional_properties = d
        return export_csr_response_200

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
