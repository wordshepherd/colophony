from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="RemoveIssueItemResponse200")



@_attrs_define
class RemoveIssueItemResponse200:
    """ 
        Attributes:
            id (UUID): Issue item ID
            issue_id (UUID): Issue ID
            pipeline_item_id (UUID): Pipeline item ID
            issue_section_id (None | UUID): Section ID (if assigned)
            sort_order (int): Sort order within section
            created_at (datetime.datetime): When the item was added
            submission_title (None | str | Unset):
     """

    id: UUID
    issue_id: UUID
    pipeline_item_id: UUID
    issue_section_id: None | UUID
    sort_order: int
    created_at: datetime.datetime
    submission_title: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        issue_id = str(self.issue_id)

        pipeline_item_id = str(self.pipeline_item_id)

        issue_section_id: None | str
        if isinstance(self.issue_section_id, UUID):
            issue_section_id = str(self.issue_section_id)
        else:
            issue_section_id = self.issue_section_id

        sort_order = self.sort_order

        created_at = self.created_at.isoformat()

        submission_title: None | str | Unset
        if isinstance(self.submission_title, Unset):
            submission_title = UNSET
        else:
            submission_title = self.submission_title


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "issueId": issue_id,
            "pipelineItemId": pipeline_item_id,
            "issueSectionId": issue_section_id,
            "sortOrder": sort_order,
            "createdAt": created_at,
        })
        if submission_title is not UNSET:
            field_dict["submissionTitle"] = submission_title

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        issue_id = UUID(d.pop("issueId"))




        pipeline_item_id = UUID(d.pop("pipelineItemId"))




        def _parse_issue_section_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                issue_section_id_type_0 = UUID(data)



                return issue_section_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        issue_section_id = _parse_issue_section_id(d.pop("issueSectionId"))


        sort_order = d.pop("sortOrder")

        created_at = isoparse(d.pop("createdAt"))




        def _parse_submission_title(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        submission_title = _parse_submission_title(d.pop("submissionTitle", UNSET))


        remove_issue_item_response_200 = cls(
            id=id,
            issue_id=issue_id,
            pipeline_item_id=pipeline_item_id,
            issue_section_id=issue_section_id,
            sort_order=sort_order,
            created_at=created_at,
            submission_title=submission_title,
        )


        remove_issue_item_response_200.additional_properties = d
        return remove_issue_item_response_200

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
