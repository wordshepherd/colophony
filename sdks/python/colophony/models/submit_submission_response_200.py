from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.submit_submission_response_200_history_entry import SubmitSubmissionResponse200HistoryEntry
  from ..models.submit_submission_response_200_submission import SubmitSubmissionResponse200Submission





T = TypeVar("T", bound="SubmitSubmissionResponse200")



@_attrs_define
class SubmitSubmissionResponse200:
    """ 
        Attributes:
            submission (SubmitSubmissionResponse200Submission):
            history_entry (SubmitSubmissionResponse200HistoryEntry):
     """

    submission: SubmitSubmissionResponse200Submission
    history_entry: SubmitSubmissionResponse200HistoryEntry
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.submit_submission_response_200_submission import SubmitSubmissionResponse200Submission
        from ..models.submit_submission_response_200_history_entry import SubmitSubmissionResponse200HistoryEntry
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
        from ..models.submit_submission_response_200_history_entry import SubmitSubmissionResponse200HistoryEntry
        from ..models.submit_submission_response_200_submission import SubmitSubmissionResponse200Submission
        d = dict(src_dict)
        submission = SubmitSubmissionResponse200Submission.from_dict(d.pop("submission"))




        history_entry = SubmitSubmissionResponse200HistoryEntry.from_dict(d.pop("historyEntry"))




        submit_submission_response_200 = cls(
            submission=submission,
            history_entry=history_entry,
        )


        submit_submission_response_200.additional_properties = d
        return submit_submission_response_200

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
