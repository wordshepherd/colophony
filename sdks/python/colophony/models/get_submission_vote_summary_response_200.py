from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="GetSubmissionVoteSummaryResponse200")


@_attrs_define
class GetSubmissionVoteSummaryResponse200:
    """
    Attributes:
        accept_count (float):
        reject_count (float):
        maybe_count (float):
        total_votes (float):
        average_score (float | None):
    """

    accept_count: float
    reject_count: float
    maybe_count: float
    total_votes: float
    average_score: float | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        accept_count = self.accept_count

        reject_count = self.reject_count

        maybe_count = self.maybe_count

        total_votes = self.total_votes

        average_score: float | None
        average_score = self.average_score

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "acceptCount": accept_count,
                "rejectCount": reject_count,
                "maybeCount": maybe_count,
                "totalVotes": total_votes,
                "averageScore": average_score,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        accept_count = d.pop("acceptCount")

        reject_count = d.pop("rejectCount")

        maybe_count = d.pop("maybeCount")

        total_votes = d.pop("totalVotes")

        def _parse_average_score(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        average_score = _parse_average_score(d.pop("averageScore"))

        get_submission_vote_summary_response_200 = cls(
            accept_count=accept_count,
            reject_count=reject_count,
            maybe_count=maybe_count,
            total_votes=total_votes,
            average_score=average_score,
        )

        get_submission_vote_summary_response_200.additional_properties = d
        return get_submission_vote_summary_response_200

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
