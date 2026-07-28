from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.cast_submission_vote_response_201_decision import CastSubmissionVoteResponse201Decision

T = TypeVar("T", bound="CastSubmissionVoteResponse201")


@_attrs_define
class CastSubmissionVoteResponse201:
    """
    Attributes:
        id (UUID):
        submission_id (UUID):
        voter_user_id (UUID):
        voter_email (None | str):
        decision (CastSubmissionVoteResponse201Decision):
        score (float | None):
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
    """

    id: UUID
    submission_id: UUID
    voter_user_id: UUID
    voter_email: None | str
    decision: CastSubmissionVoteResponse201Decision
    score: float | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        submission_id = str(self.submission_id)

        voter_user_id = str(self.voter_user_id)

        voter_email: None | str
        voter_email = self.voter_email

        decision = self.decision.value

        score: float | None
        score = self.score

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "submissionId": submission_id,
                "voterUserId": voter_user_id,
                "voterEmail": voter_email,
                "decision": decision,
                "score": score,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        submission_id = UUID(d.pop("submissionId"))

        voter_user_id = UUID(d.pop("voterUserId"))

        def _parse_voter_email(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        voter_email = _parse_voter_email(d.pop("voterEmail"))

        decision = CastSubmissionVoteResponse201Decision(d.pop("decision"))

        def _parse_score(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        score = _parse_score(d.pop("score"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))

        cast_submission_vote_response_201 = cls(
            id=id,
            submission_id=submission_id,
            voter_user_id=voter_user_id,
            voter_email=voter_email,
            decision=decision,
            score=score,
            created_at=created_at,
            updated_at=updated_at,
        )

        cast_submission_vote_response_201.additional_properties = d
        return cast_submission_vote_response_201

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
