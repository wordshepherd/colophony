from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.export_csr_response_200_external_submissions_item_status import (
    ExportCsrResponse200ExternalSubmissionsItemStatus,
)

T = TypeVar("T", bound="ExportCsrResponse200ExternalSubmissionsItem")


@_attrs_define
class ExportCsrResponse200ExternalSubmissionsItem:
    """Manually-tracked external submission record

    Attributes:
        id (UUID):
        manuscript_id (None | UUID):
        journal_directory_id (None | UUID):
        journal_name (str):
        status (ExportCsrResponse200ExternalSubmissionsItemStatus): Harmonized submission status across systems
        sent_at (datetime.datetime | None):
        responded_at (datetime.datetime | None):
        method (None | str):
        notes (None | str):
        imported_from (None | str):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: UUID
    manuscript_id: None | UUID
    journal_directory_id: None | UUID
    journal_name: str
    status: ExportCsrResponse200ExternalSubmissionsItemStatus
    sent_at: datetime.datetime | None
    responded_at: datetime.datetime | None
    method: None | str
    notes: None | str
    imported_from: None | str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        manuscript_id: None | str
        if isinstance(self.manuscript_id, UUID):
            manuscript_id = str(self.manuscript_id)
        else:
            manuscript_id = self.manuscript_id

        journal_directory_id: None | str
        if isinstance(self.journal_directory_id, UUID):
            journal_directory_id = str(self.journal_directory_id)
        else:
            journal_directory_id = self.journal_directory_id

        journal_name = self.journal_name

        status = self.status.value

        sent_at: None | str
        if isinstance(self.sent_at, datetime.datetime):
            sent_at = self.sent_at.isoformat()
        else:
            sent_at = self.sent_at

        responded_at: None | str
        if isinstance(self.responded_at, datetime.datetime):
            responded_at = self.responded_at.isoformat()
        else:
            responded_at = self.responded_at

        method: None | str
        method = self.method

        notes: None | str
        notes = self.notes

        imported_from: None | str
        imported_from = self.imported_from

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "manuscriptId": manuscript_id,
                "journalDirectoryId": journal_directory_id,
                "journalName": journal_name,
                "status": status,
                "sentAt": sent_at,
                "respondedAt": responded_at,
                "method": method,
                "notes": notes,
                "importedFrom": imported_from,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        def _parse_manuscript_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                manuscript_id_type_0 = UUID(data)

                return manuscript_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        manuscript_id = _parse_manuscript_id(d.pop("manuscriptId"))

        def _parse_journal_directory_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                journal_directory_id_type_0 = UUID(data)

                return journal_directory_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        journal_directory_id = _parse_journal_directory_id(d.pop("journalDirectoryId"))

        journal_name = d.pop("journalName")

        status = ExportCsrResponse200ExternalSubmissionsItemStatus(d.pop("status"))

        def _parse_sent_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                sent_at_type_0 = datetime.datetime.fromisoformat(data)

                return sent_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        sent_at = _parse_sent_at(d.pop("sentAt"))

        def _parse_responded_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                responded_at_type_0 = datetime.datetime.fromisoformat(data)

                return responded_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        responded_at = _parse_responded_at(d.pop("respondedAt"))

        def _parse_method(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        method = _parse_method(d.pop("method"))

        def _parse_notes(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        notes = _parse_notes(d.pop("notes"))

        def _parse_imported_from(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        imported_from = _parse_imported_from(d.pop("importedFrom"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))

        export_csr_response_200_external_submissions_item = cls(
            id=id,
            manuscript_id=manuscript_id,
            journal_directory_id=journal_directory_id,
            journal_name=journal_name,
            status=status,
            sent_at=sent_at,
            responded_at=responded_at,
            method=method,
            notes=notes,
            imported_from=imported_from,
            created_at=created_at,
            updated_at=updated_at,
        )

        export_csr_response_200_external_submissions_item.additional_properties = d
        return export_csr_response_200_external_submissions_item

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
