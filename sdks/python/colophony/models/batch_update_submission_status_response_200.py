from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.batch_update_submission_status_response_200_failed_item import (
        BatchUpdateSubmissionStatusResponse200FailedItem,
    )
    from ..models.batch_update_submission_status_response_200_succeeded_item import (
        BatchUpdateSubmissionStatusResponse200SucceededItem,
    )


T = TypeVar("T", bound="BatchUpdateSubmissionStatusResponse200")


@_attrs_define
class BatchUpdateSubmissionStatusResponse200:
    """
    Attributes:
        succeeded (list[BatchUpdateSubmissionStatusResponse200SucceededItem]):
        failed (list[BatchUpdateSubmissionStatusResponse200FailedItem]):
    """

    succeeded: list[BatchUpdateSubmissionStatusResponse200SucceededItem]
    failed: list[BatchUpdateSubmissionStatusResponse200FailedItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        succeeded = []
        for succeeded_item_data in self.succeeded:
            succeeded_item = succeeded_item_data.to_dict()
            succeeded.append(succeeded_item)

        failed = []
        for failed_item_data in self.failed:
            failed_item = failed_item_data.to_dict()
            failed.append(failed_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "succeeded": succeeded,
                "failed": failed,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.batch_update_submission_status_response_200_failed_item import (
            BatchUpdateSubmissionStatusResponse200FailedItem,
        )
        from ..models.batch_update_submission_status_response_200_succeeded_item import (
            BatchUpdateSubmissionStatusResponse200SucceededItem,
        )

        d = dict(src_dict)
        succeeded = []
        _succeeded = d.pop("succeeded")
        for succeeded_item_data in _succeeded:
            succeeded_item = BatchUpdateSubmissionStatusResponse200SucceededItem.from_dict(succeeded_item_data)

            succeeded.append(succeeded_item)

        failed = []
        _failed = d.pop("failed")
        for failed_item_data in _failed:
            failed_item = BatchUpdateSubmissionStatusResponse200FailedItem.from_dict(failed_item_data)

            failed.append(failed_item)

        batch_update_submission_status_response_200 = cls(
            succeeded=succeeded,
            failed=failed,
        )

        batch_update_submission_status_response_200.additional_properties = d
        return batch_update_submission_status_response_200

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
