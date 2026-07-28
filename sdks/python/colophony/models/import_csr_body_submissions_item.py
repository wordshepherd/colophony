from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.import_csr_body_submissions_item_status import ImportCsrBodySubmissionsItemStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="ImportCsrBodySubmissionsItem")


@_attrs_define
class ImportCsrBodySubmissionsItem:
    """
    Attributes:
        journal_name (str):
        journal_directory_id (UUID | Unset):
        status (ImportCsrBodySubmissionsItemStatus | Unset): Harmonized submission status across systems Default:
            ImportCsrBodySubmissionsItemStatus.SENT.
        sent_at (datetime.datetime | Unset):
        responded_at (datetime.datetime | Unset):
        method (str | Unset):
        notes (str | Unset):
        imported_from (str | Unset):
    """

    journal_name: str
    journal_directory_id: UUID | Unset = UNSET
    status: ImportCsrBodySubmissionsItemStatus | Unset = ImportCsrBodySubmissionsItemStatus.SENT
    sent_at: datetime.datetime | Unset = UNSET
    responded_at: datetime.datetime | Unset = UNSET
    method: str | Unset = UNSET
    notes: str | Unset = UNSET
    imported_from: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        journal_name = self.journal_name

        journal_directory_id: str | Unset = UNSET
        if not isinstance(self.journal_directory_id, Unset):
            journal_directory_id = str(self.journal_directory_id)

        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value

        sent_at: str | Unset = UNSET
        if not isinstance(self.sent_at, Unset):
            sent_at = self.sent_at.isoformat()

        responded_at: str | Unset = UNSET
        if not isinstance(self.responded_at, Unset):
            responded_at = self.responded_at.isoformat()

        method = self.method

        notes = self.notes

        imported_from = self.imported_from

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "journalName": journal_name,
            }
        )
        if journal_directory_id is not UNSET:
            field_dict["journalDirectoryId"] = journal_directory_id
        if status is not UNSET:
            field_dict["status"] = status
        if sent_at is not UNSET:
            field_dict["sentAt"] = sent_at
        if responded_at is not UNSET:
            field_dict["respondedAt"] = responded_at
        if method is not UNSET:
            field_dict["method"] = method
        if notes is not UNSET:
            field_dict["notes"] = notes
        if imported_from is not UNSET:
            field_dict["importedFrom"] = imported_from

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        journal_name = d.pop("journalName")

        _journal_directory_id = d.pop("journalDirectoryId", UNSET)
        journal_directory_id: UUID | Unset
        if isinstance(_journal_directory_id, Unset):
            journal_directory_id = UNSET
        else:
            journal_directory_id = UUID(_journal_directory_id)

        _status = d.pop("status", UNSET)
        status: ImportCsrBodySubmissionsItemStatus | Unset
        if isinstance(_status, Unset):
            status = UNSET
        else:
            status = ImportCsrBodySubmissionsItemStatus(_status)

        _sent_at = d.pop("sentAt", UNSET)
        sent_at: datetime.datetime | Unset
        if isinstance(_sent_at, Unset):
            sent_at = UNSET
        else:
            sent_at = datetime.datetime.fromisoformat(_sent_at)

        _responded_at = d.pop("respondedAt", UNSET)
        responded_at: datetime.datetime | Unset
        if isinstance(_responded_at, Unset):
            responded_at = UNSET
        else:
            responded_at = datetime.datetime.fromisoformat(_responded_at)

        method = d.pop("method", UNSET)

        notes = d.pop("notes", UNSET)

        imported_from = d.pop("importedFrom", UNSET)

        import_csr_body_submissions_item = cls(
            journal_name=journal_name,
            journal_directory_id=journal_directory_id,
            status=status,
            sent_at=sent_at,
            responded_at=responded_at,
            method=method,
            notes=notes,
            imported_from=imported_from,
        )

        import_csr_body_submissions_item.additional_properties = d
        return import_csr_body_submissions_item

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
