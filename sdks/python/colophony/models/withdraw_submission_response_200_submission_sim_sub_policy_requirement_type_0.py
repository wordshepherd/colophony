from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.withdraw_submission_response_200_submission_sim_sub_policy_requirement_type_0_type import (
    WithdrawSubmissionResponse200SubmissionSimSubPolicyRequirementType0Type,
)
from ..types import UNSET, Unset

T = TypeVar("T", bound="WithdrawSubmissionResponse200SubmissionSimSubPolicyRequirementType0")


@_attrs_define
class WithdrawSubmissionResponse200SubmissionSimSubPolicyRequirementType0:
    """
    Attributes:
        type_ (WithdrawSubmissionResponse200SubmissionSimSubPolicyRequirementType0Type):
        window_hours (int | Unset):
        acknowledged_at (datetime.datetime | Unset):
        due_at (datetime.datetime | Unset):
    """

    type_: WithdrawSubmissionResponse200SubmissionSimSubPolicyRequirementType0Type
    window_hours: int | Unset = UNSET
    acknowledged_at: datetime.datetime | Unset = UNSET
    due_at: datetime.datetime | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        window_hours = self.window_hours

        acknowledged_at: str | Unset = UNSET
        if not isinstance(self.acknowledged_at, Unset):
            acknowledged_at = self.acknowledged_at.isoformat()

        due_at: str | Unset = UNSET
        if not isinstance(self.due_at, Unset):
            due_at = self.due_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
            }
        )
        if window_hours is not UNSET:
            field_dict["windowHours"] = window_hours
        if acknowledged_at is not UNSET:
            field_dict["acknowledgedAt"] = acknowledged_at
        if due_at is not UNSET:
            field_dict["dueAt"] = due_at

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = WithdrawSubmissionResponse200SubmissionSimSubPolicyRequirementType0Type(d.pop("type"))

        window_hours = d.pop("windowHours", UNSET)

        _acknowledged_at = d.pop("acknowledgedAt", UNSET)
        acknowledged_at: datetime.datetime | Unset
        if isinstance(_acknowledged_at, Unset):
            acknowledged_at = UNSET
        else:
            acknowledged_at = datetime.datetime.fromisoformat(_acknowledged_at)

        _due_at = d.pop("dueAt", UNSET)
        due_at: datetime.datetime | Unset
        if isinstance(_due_at, Unset):
            due_at = UNSET
        else:
            due_at = datetime.datetime.fromisoformat(_due_at)

        withdraw_submission_response_200_submission_sim_sub_policy_requirement_type_0 = cls(
            type_=type_,
            window_hours=window_hours,
            acknowledged_at=acknowledged_at,
            due_at=due_at,
        )

        withdraw_submission_response_200_submission_sim_sub_policy_requirement_type_0.additional_properties = d
        return withdraw_submission_response_200_submission_sim_sub_policy_requirement_type_0

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
