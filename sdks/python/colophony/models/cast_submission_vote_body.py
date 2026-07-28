from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.cast_submission_vote_body_decision import CastSubmissionVoteBodyDecision
from ..types import UNSET, Unset

T = TypeVar("T", bound="CastSubmissionVoteBody")


@_attrs_define
class CastSubmissionVoteBody:
    """
    Attributes:
        decision (CastSubmissionVoteBodyDecision):
        score (float | Unset):
    """

    decision: CastSubmissionVoteBodyDecision
    score: float | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        decision = self.decision.value

        score = self.score

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "decision": decision,
            }
        )
        if score is not UNSET:
            field_dict["score"] = score

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        decision = CastSubmissionVoteBodyDecision(d.pop("decision"))

        score = d.pop("score", UNSET)

        cast_submission_vote_body = cls(
            decision=decision,
            score=score,
        )

        cast_submission_vote_body.additional_properties = d
        return cast_submission_vote_body

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
