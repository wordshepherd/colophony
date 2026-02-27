from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.update_submission_status_response_200_history_entry import UpdateSubmissionStatusResponse200HistoryEntry
  from ..models.update_submission_status_response_200_submission import UpdateSubmissionStatusResponse200Submission





T = TypeVar("T", bound="UpdateSubmissionStatusResponse200")



@_attrs_define
class UpdateSubmissionStatusResponse200:
    """ 
        Attributes:
            submission (UpdateSubmissionStatusResponse200Submission):
            history_entry (UpdateSubmissionStatusResponse200HistoryEntry):
     """

    submission: UpdateSubmissionStatusResponse200Submission
    history_entry: UpdateSubmissionStatusResponse200HistoryEntry
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_submission_status_response_200_history_entry import UpdateSubmissionStatusResponse200HistoryEntry
        from ..models.update_submission_status_response_200_submission import UpdateSubmissionStatusResponse200Submission
        submission = self.submission.to_dict()

        history_entry = self.history_entry.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "submission": submission,
            "historyEntry": history_entry,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_submission_status_response_200_history_entry import UpdateSubmissionStatusResponse200HistoryEntry
        from ..models.update_submission_status_response_200_submission import UpdateSubmissionStatusResponse200Submission
        d = dict(src_dict)
        submission = UpdateSubmissionStatusResponse200Submission.from_dict(d.pop("submission"))




        history_entry = UpdateSubmissionStatusResponse200HistoryEntry.from_dict(d.pop("historyEntry"))




        update_submission_status_response_200 = cls(
            submission=submission,
            history_entry=history_entry,
        )


        update_submission_status_response_200.additional_properties = d
        return update_submission_status_response_200

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
