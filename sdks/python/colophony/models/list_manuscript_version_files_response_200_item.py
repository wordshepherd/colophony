from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_manuscript_version_files_response_200_item_scan_status import ListManuscriptVersionFilesResponse200ItemScanStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListManuscriptVersionFilesResponse200Item")



@_attrs_define
class ListManuscriptVersionFilesResponse200Item:
    """ 
        Attributes:
            id (UUID): Unique identifier for the file
            manuscript_version_id (UUID): ID of the manuscript version this file belongs to
            filename (str): Original filename as uploaded
            mime_type (str): MIME type of the file (e.g. application/pdf)
            size (float): File size in bytes
            storage_key (str): Object storage key
            scan_status (ListManuscriptVersionFilesResponse200ItemScanStatus): Virus scan status for an uploaded file
            scanned_at (datetime.datetime | None): When the virus scan completed
            uploaded_at (datetime.datetime): When the file was uploaded
     """

    id: UUID
    manuscript_version_id: UUID
    filename: str
    mime_type: str
    size: float
    storage_key: str
    scan_status: ListManuscriptVersionFilesResponse200ItemScanStatus
    scanned_at: datetime.datetime | None
    uploaded_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        manuscript_version_id = str(self.manuscript_version_id)

        filename = self.filename

        mime_type = self.mime_type

        size = self.size

        storage_key = self.storage_key

        scan_status = self.scan_status.value

        scanned_at: None | str
        if isinstance(self.scanned_at, datetime.datetime):
            scanned_at = self.scanned_at.isoformat()
        else:
            scanned_at = self.scanned_at

        uploaded_at = self.uploaded_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "manuscriptVersionId": manuscript_version_id,
            "filename": filename,
            "mimeType": mime_type,
            "size": size,
            "storageKey": storage_key,
            "scanStatus": scan_status,
            "scannedAt": scanned_at,
            "uploadedAt": uploaded_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        manuscript_version_id = UUID(d.pop("manuscriptVersionId"))




        filename = d.pop("filename")

        mime_type = d.pop("mimeType")

        size = d.pop("size")

        storage_key = d.pop("storageKey")

        scan_status = ListManuscriptVersionFilesResponse200ItemScanStatus(d.pop("scanStatus"))




        def _parse_scanned_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                scanned_at_type_0 = isoparse(data)



                return scanned_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        scanned_at = _parse_scanned_at(d.pop("scannedAt"))


        uploaded_at = isoparse(d.pop("uploadedAt"))




        list_manuscript_version_files_response_200_item = cls(
            id=id,
            manuscript_version_id=manuscript_version_id,
            filename=filename,
            mime_type=mime_type,
            size=size,
            storage_key=storage_key,
            scan_status=scan_status,
            scanned_at=scanned_at,
            uploaded_at=uploaded_at,
        )


        list_manuscript_version_files_response_200_item.additional_properties = d
        return list_manuscript_version_files_response_200_item

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
