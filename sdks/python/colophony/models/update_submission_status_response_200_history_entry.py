from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_submission_status_response_200_history_entry_from_status_type_0 import UpdateSubmissionStatusResponse200HistoryEntryFromStatusType0
from ..models.update_submission_status_response_200_history_entry_to_status import UpdateSubmissionStatusResponse200HistoryEntryToStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="UpdateSubmissionStatusResponse200HistoryEntry")



@_attrs_define
class UpdateSubmissionStatusResponse200HistoryEntry:
    """ 
        Attributes:
            id (UUID): History entry ID
            submission_id (UUID): ID of the submission
            from_status (None | UpdateSubmissionStatusResponse200HistoryEntryFromStatusType0): Previous status (null for
                initial creation)
            to_status (UpdateSubmissionStatusResponse200HistoryEntryToStatus): New status after the transition
            changed_by (None | UUID): ID of the user who made the change
            comment (None | str): Optional comment explaining the status change
            changed_at (datetime.datetime): When the status change occurred
     """

    id: UUID
    submission_id: UUID
    from_status: None | UpdateSubmissionStatusResponse200HistoryEntryFromStatusType0
    to_status: UpdateSubmissionStatusResponse200HistoryEntryToStatus
    changed_by: None | UUID
    comment: None | str
    changed_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        submission_id = str(self.submission_id)

        from_status: None | str
        if isinstance(self.from_status, UpdateSubmissionStatusResponse200HistoryEntryFromStatusType0):
            from_status = self.from_status.value
        else:
            from_status = self.from_status

        to_status = self.to_status.value

        changed_by: None | str
        if isinstance(self.changed_by, UUID):
            changed_by = str(self.changed_by)
        else:
            changed_by = self.changed_by

        comment: None | str
        comment = self.comment

        changed_at = self.changed_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "submissionId": submission_id,
            "fromStatus": from_status,
            "toStatus": to_status,
            "changedBy": changed_by,
            "comment": comment,
            "changedAt": changed_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        submission_id = UUID(d.pop("submissionId"))




        def _parse_from_status(data: object) -> None | UpdateSubmissionStatusResponse200HistoryEntryFromStatusType0:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                from_status_type_0 = UpdateSubmissionStatusResponse200HistoryEntryFromStatusType0(data)



                return from_status_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UpdateSubmissionStatusResponse200HistoryEntryFromStatusType0, data)

        from_status = _parse_from_status(d.pop("fromStatus"))


        to_status = UpdateSubmissionStatusResponse200HistoryEntryToStatus(d.pop("toStatus"))




        def _parse_changed_by(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                changed_by_type_0 = UUID(data)



                return changed_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        changed_by = _parse_changed_by(d.pop("changedBy"))


        def _parse_comment(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        comment = _parse_comment(d.pop("comment"))


        changed_at = isoparse(d.pop("changedAt"))




        update_submission_status_response_200_history_entry = cls(
            id=id,
            submission_id=submission_id,
            from_status=from_status,
            to_status=to_status,
            changed_by=changed_by,
            comment=comment,
            changed_at=changed_at,
        )


        update_submission_status_response_200_history_entry.additional_properties = d
        return update_submission_status_response_200_history_entry

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
