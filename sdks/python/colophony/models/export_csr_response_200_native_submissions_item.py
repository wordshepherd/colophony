from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.export_csr_response_200_native_submissions_item_status import (
    ExportCsrResponse200NativeSubmissionsItemStatus,
)

if TYPE_CHECKING:
    from ..models.export_csr_response_200_native_submissions_item_form_data_type_0 import (
        ExportCsrResponse200NativeSubmissionsItemFormDataType0,
    )
    from ..models.export_csr_response_200_native_submissions_item_genre_type_0 import (
        ExportCsrResponse200NativeSubmissionsItemGenreType0,
    )
    from ..models.export_csr_response_200_native_submissions_item_status_history_item import (
        ExportCsrResponse200NativeSubmissionsItemStatusHistoryItem,
    )


T = TypeVar("T", bound="ExportCsrResponse200NativeSubmissionsItem")


@_attrs_define
class ExportCsrResponse200NativeSubmissionsItem:
    """Colophony-native submission record for CSR export

    Attributes:
        origin_submission_id (UUID):
        title (None | str):
        genre (ExportCsrResponse200NativeSubmissionsItemGenreType0 | None):
        cover_letter (None | str):
        status (ExportCsrResponse200NativeSubmissionsItemStatus): Harmonized submission status across systems
        form_data (ExportCsrResponse200NativeSubmissionsItemFormDataType0 | None):
        submitted_at (datetime.datetime | None):
        decided_at (datetime.datetime | None):
        publication_name (None | str):
        period_name (None | str):
        status_history (list[ExportCsrResponse200NativeSubmissionsItemStatusHistoryItem]):
    """

    origin_submission_id: UUID
    title: None | str
    genre: ExportCsrResponse200NativeSubmissionsItemGenreType0 | None
    cover_letter: None | str
    status: ExportCsrResponse200NativeSubmissionsItemStatus
    form_data: ExportCsrResponse200NativeSubmissionsItemFormDataType0 | None
    submitted_at: datetime.datetime | None
    decided_at: datetime.datetime | None
    publication_name: None | str
    period_name: None | str
    status_history: list[ExportCsrResponse200NativeSubmissionsItemStatusHistoryItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.export_csr_response_200_native_submissions_item_form_data_type_0 import (
            ExportCsrResponse200NativeSubmissionsItemFormDataType0,
        )
        from ..models.export_csr_response_200_native_submissions_item_genre_type_0 import (
            ExportCsrResponse200NativeSubmissionsItemGenreType0,
        )

        origin_submission_id = str(self.origin_submission_id)

        title: None | str
        title = self.title

        genre: dict[str, Any] | None
        if isinstance(self.genre, ExportCsrResponse200NativeSubmissionsItemGenreType0):
            genre = self.genre.to_dict()
        else:
            genre = self.genre

        cover_letter: None | str
        cover_letter = self.cover_letter

        status = self.status.value

        form_data: dict[str, Any] | None
        if isinstance(self.form_data, ExportCsrResponse200NativeSubmissionsItemFormDataType0):
            form_data = self.form_data.to_dict()
        else:
            form_data = self.form_data

        submitted_at: None | str
        if isinstance(self.submitted_at, datetime.datetime):
            submitted_at = self.submitted_at.isoformat()
        else:
            submitted_at = self.submitted_at

        decided_at: None | str
        if isinstance(self.decided_at, datetime.datetime):
            decided_at = self.decided_at.isoformat()
        else:
            decided_at = self.decided_at

        publication_name: None | str
        publication_name = self.publication_name

        period_name: None | str
        period_name = self.period_name

        status_history = []
        for status_history_item_data in self.status_history:
            status_history_item = status_history_item_data.to_dict()
            status_history.append(status_history_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "originSubmissionId": origin_submission_id,
                "title": title,
                "genre": genre,
                "coverLetter": cover_letter,
                "status": status,
                "formData": form_data,
                "submittedAt": submitted_at,
                "decidedAt": decided_at,
                "publicationName": publication_name,
                "periodName": period_name,
                "statusHistory": status_history,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.export_csr_response_200_native_submissions_item_form_data_type_0 import (
            ExportCsrResponse200NativeSubmissionsItemFormDataType0,
        )
        from ..models.export_csr_response_200_native_submissions_item_genre_type_0 import (
            ExportCsrResponse200NativeSubmissionsItemGenreType0,
        )
        from ..models.export_csr_response_200_native_submissions_item_status_history_item import (
            ExportCsrResponse200NativeSubmissionsItemStatusHistoryItem,
        )

        d = dict(src_dict)
        origin_submission_id = UUID(d.pop("originSubmissionId"))

        def _parse_title(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        title = _parse_title(d.pop("title"))

        def _parse_genre(data: object) -> ExportCsrResponse200NativeSubmissionsItemGenreType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                genre_type_0 = ExportCsrResponse200NativeSubmissionsItemGenreType0.from_dict(data)

                return genre_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ExportCsrResponse200NativeSubmissionsItemGenreType0 | None, data)

        genre = _parse_genre(d.pop("genre"))

        def _parse_cover_letter(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cover_letter = _parse_cover_letter(d.pop("coverLetter"))

        status = ExportCsrResponse200NativeSubmissionsItemStatus(d.pop("status"))

        def _parse_form_data(data: object) -> ExportCsrResponse200NativeSubmissionsItemFormDataType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                form_data_type_0 = ExportCsrResponse200NativeSubmissionsItemFormDataType0.from_dict(data)

                return form_data_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(ExportCsrResponse200NativeSubmissionsItemFormDataType0 | None, data)

        form_data = _parse_form_data(d.pop("formData"))

        def _parse_submitted_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                submitted_at_type_0 = datetime.datetime.fromisoformat(data)

                return submitted_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        submitted_at = _parse_submitted_at(d.pop("submittedAt"))

        def _parse_decided_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                decided_at_type_0 = datetime.datetime.fromisoformat(data)

                return decided_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        decided_at = _parse_decided_at(d.pop("decidedAt"))

        def _parse_publication_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        publication_name = _parse_publication_name(d.pop("publicationName"))

        def _parse_period_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        period_name = _parse_period_name(d.pop("periodName"))

        status_history = []
        _status_history = d.pop("statusHistory")
        for status_history_item_data in _status_history:
            status_history_item = ExportCsrResponse200NativeSubmissionsItemStatusHistoryItem.from_dict(
                status_history_item_data
            )

            status_history.append(status_history_item)

        export_csr_response_200_native_submissions_item = cls(
            origin_submission_id=origin_submission_id,
            title=title,
            genre=genre,
            cover_letter=cover_letter,
            status=status,
            form_data=form_data,
            submitted_at=submitted_at,
            decided_at=decided_at,
            publication_name=publication_name,
            period_name=period_name,
            status_history=status_history,
        )

        export_csr_response_200_native_submissions_item.additional_properties = d
        return export_csr_response_200_native_submissions_item

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
