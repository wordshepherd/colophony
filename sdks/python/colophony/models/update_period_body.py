from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.update_period_body_blind_review_mode import UpdatePeriodBodyBlindReviewMode
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.update_period_body_sim_sub_policy import UpdatePeriodBodySimSubPolicy


T = TypeVar("T", bound="UpdatePeriodBody")


@_attrs_define
class UpdatePeriodBody:
    """
    Attributes:
        name (str | Unset): Display name for the submission period
        description (str | Unset): Description of the period (max 2,000 chars)
        opens_at (datetime.datetime | Unset): When submissions open (ISO-8601)
        closes_at (datetime.datetime | Unset): When submissions close (ISO-8601)
        fee (float | Unset): Submission fee in cents (omit for free)
        max_submissions (int | Unset): Maximum number of submissions (omit for unlimited)
        form_definition_id (None | Unset | UUID): Form definition to link (null to unlink)
        sim_sub_policy (UpdatePeriodBodySimSubPolicy | Unset): Sim-sub policy (default: allowed)
        blind_review_mode (UpdatePeriodBodyBlindReviewMode | Unset): Blind review mode: none, single_blind, or
            double_blind (default: none)
        is_contest (bool | Unset): Whether this period is a contest (default: false)
        contest_prize (str | Unset): Prize description for contests (max 500 chars)
        contest_winners_announced_at (datetime.datetime | Unset): When contest winners will be announced (ISO-8601)
        contest_group_id (UUID | Unset): Contest group to associate with
        contest_round (int | Unset): Round number within the contest group
    """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    opens_at: datetime.datetime | Unset = UNSET
    closes_at: datetime.datetime | Unset = UNSET
    fee: float | Unset = UNSET
    max_submissions: int | Unset = UNSET
    form_definition_id: None | Unset | UUID = UNSET
    sim_sub_policy: UpdatePeriodBodySimSubPolicy | Unset = UNSET
    blind_review_mode: UpdatePeriodBodyBlindReviewMode | Unset = UNSET
    is_contest: bool | Unset = UNSET
    contest_prize: str | Unset = UNSET
    contest_winners_announced_at: datetime.datetime | Unset = UNSET
    contest_group_id: UUID | Unset = UNSET
    contest_round: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        opens_at: str | Unset = UNSET
        if not isinstance(self.opens_at, Unset):
            opens_at = self.opens_at.isoformat()

        closes_at: str | Unset = UNSET
        if not isinstance(self.closes_at, Unset):
            closes_at = self.closes_at.isoformat()

        fee = self.fee

        max_submissions = self.max_submissions

        form_definition_id: None | str | Unset
        if isinstance(self.form_definition_id, Unset):
            form_definition_id = UNSET
        elif isinstance(self.form_definition_id, UUID):
            form_definition_id = str(self.form_definition_id)
        else:
            form_definition_id = self.form_definition_id

        sim_sub_policy: dict[str, Any] | Unset = UNSET
        if not isinstance(self.sim_sub_policy, Unset):
            sim_sub_policy = self.sim_sub_policy.to_dict()

        blind_review_mode: str | Unset = UNSET
        if not isinstance(self.blind_review_mode, Unset):
            blind_review_mode = self.blind_review_mode.value

        is_contest = self.is_contest

        contest_prize = self.contest_prize

        contest_winners_announced_at: str | Unset = UNSET
        if not isinstance(self.contest_winners_announced_at, Unset):
            contest_winners_announced_at = self.contest_winners_announced_at.isoformat()

        contest_group_id: str | Unset = UNSET
        if not isinstance(self.contest_group_id, Unset):
            contest_group_id = str(self.contest_group_id)

        contest_round = self.contest_round

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if opens_at is not UNSET:
            field_dict["opensAt"] = opens_at
        if closes_at is not UNSET:
            field_dict["closesAt"] = closes_at
        if fee is not UNSET:
            field_dict["fee"] = fee
        if max_submissions is not UNSET:
            field_dict["maxSubmissions"] = max_submissions
        if form_definition_id is not UNSET:
            field_dict["formDefinitionId"] = form_definition_id
        if sim_sub_policy is not UNSET:
            field_dict["simSubPolicy"] = sim_sub_policy
        if blind_review_mode is not UNSET:
            field_dict["blindReviewMode"] = blind_review_mode
        if is_contest is not UNSET:
            field_dict["isContest"] = is_contest
        if contest_prize is not UNSET:
            field_dict["contestPrize"] = contest_prize
        if contest_winners_announced_at is not UNSET:
            field_dict["contestWinnersAnnouncedAt"] = contest_winners_announced_at
        if contest_group_id is not UNSET:
            field_dict["contestGroupId"] = contest_group_id
        if contest_round is not UNSET:
            field_dict["contestRound"] = contest_round

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_period_body_sim_sub_policy import UpdatePeriodBodySimSubPolicy

        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        _opens_at = d.pop("opensAt", UNSET)
        opens_at: datetime.datetime | Unset
        if isinstance(_opens_at, Unset):
            opens_at = UNSET
        else:
            opens_at = datetime.datetime.fromisoformat(_opens_at)

        _closes_at = d.pop("closesAt", UNSET)
        closes_at: datetime.datetime | Unset
        if isinstance(_closes_at, Unset):
            closes_at = UNSET
        else:
            closes_at = datetime.datetime.fromisoformat(_closes_at)

        fee = d.pop("fee", UNSET)

        max_submissions = d.pop("maxSubmissions", UNSET)

        def _parse_form_definition_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                form_definition_id_type_0 = UUID(data)

                return form_definition_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        form_definition_id = _parse_form_definition_id(d.pop("formDefinitionId", UNSET))

        _sim_sub_policy = d.pop("simSubPolicy", UNSET)
        sim_sub_policy: UpdatePeriodBodySimSubPolicy | Unset
        if isinstance(_sim_sub_policy, Unset):
            sim_sub_policy = UNSET
        else:
            sim_sub_policy = UpdatePeriodBodySimSubPolicy.from_dict(_sim_sub_policy)

        _blind_review_mode = d.pop("blindReviewMode", UNSET)
        blind_review_mode: UpdatePeriodBodyBlindReviewMode | Unset
        if isinstance(_blind_review_mode, Unset):
            blind_review_mode = UNSET
        else:
            blind_review_mode = UpdatePeriodBodyBlindReviewMode(_blind_review_mode)

        is_contest = d.pop("isContest", UNSET)

        contest_prize = d.pop("contestPrize", UNSET)

        _contest_winners_announced_at = d.pop("contestWinnersAnnouncedAt", UNSET)
        contest_winners_announced_at: datetime.datetime | Unset
        if isinstance(_contest_winners_announced_at, Unset):
            contest_winners_announced_at = UNSET
        else:
            contest_winners_announced_at = datetime.datetime.fromisoformat(_contest_winners_announced_at)

        _contest_group_id = d.pop("contestGroupId", UNSET)
        contest_group_id: UUID | Unset
        if isinstance(_contest_group_id, Unset):
            contest_group_id = UNSET
        else:
            contest_group_id = UUID(_contest_group_id)

        contest_round = d.pop("contestRound", UNSET)

        update_period_body = cls(
            name=name,
            description=description,
            opens_at=opens_at,
            closes_at=closes_at,
            fee=fee,
            max_submissions=max_submissions,
            form_definition_id=form_definition_id,
            sim_sub_policy=sim_sub_policy,
            blind_review_mode=blind_review_mode,
            is_contest=is_contest,
            contest_prize=contest_prize,
            contest_winners_announced_at=contest_winners_announced_at,
            contest_group_id=contest_group_id,
            contest_round=contest_round,
        )

        update_period_body.additional_properties = d
        return update_period_body

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
