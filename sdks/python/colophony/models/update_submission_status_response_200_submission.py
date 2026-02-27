from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.update_submission_status_response_200_submission_status import UpdateSubmissionStatusResponse200SubmissionStatus
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.update_submission_status_response_200_submission_form_data_type_0 import UpdateSubmissionStatusResponse200SubmissionFormDataType0





T = TypeVar("T", bound="UpdateSubmissionStatusResponse200Submission")



@_attrs_define
class UpdateSubmissionStatusResponse200Submission:
    """ 
        Attributes:
            id (UUID): Unique identifier for the submission
            organization_id (UUID): ID of the organization this submission belongs to
            submitter_id (None | UUID): ID of the user who created the submission
            submission_period_id (None | UUID): ID of the submission period, if applicable
            title (None | str): Title of the submission
            content (None | str): Body content of the submission
            cover_letter (None | str): Optional cover letter
            form_definition_id (None | UUID): ID of the form definition used, if applicable
            form_data (None | UpdateSubmissionStatusResponse200SubmissionFormDataType0): Structured form data keyed by field
                key
            manuscript_version_id (None | UUID): ID of the manuscript version attached to this submission
            status (UpdateSubmissionStatusResponse200SubmissionStatus): Current status in the submission workflow
            submitted_at (datetime.datetime | None): When the submission was formally submitted
            created_at (datetime.datetime): When the submission was created
            updated_at (datetime.datetime): When the submission was last updated
     """

    id: UUID
    organization_id: UUID
    submitter_id: None | UUID
    submission_period_id: None | UUID
    title: None | str
    content: None | str
    cover_letter: None | str
    form_definition_id: None | UUID
    form_data: None | UpdateSubmissionStatusResponse200SubmissionFormDataType0
    manuscript_version_id: None | UUID
    status: UpdateSubmissionStatusResponse200SubmissionStatus
    submitted_at: datetime.datetime | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_submission_status_response_200_submission_form_data_type_0 import UpdateSubmissionStatusResponse200SubmissionFormDataType0
        id = str(self.id)

        organization_id = str(self.organization_id)

        submitter_id: None | str
        if isinstance(self.submitter_id, UUID):
            submitter_id = str(self.submitter_id)
        else:
            submitter_id = self.submitter_id

        submission_period_id: None | str
        if isinstance(self.submission_period_id, UUID):
            submission_period_id = str(self.submission_period_id)
        else:
            submission_period_id = self.submission_period_id

        title: None | str
        title = self.title

        content: None | str
        content = self.content

        cover_letter: None | str
        cover_letter = self.cover_letter

        form_definition_id: None | str
        if isinstance(self.form_definition_id, UUID):
            form_definition_id = str(self.form_definition_id)
        else:
            form_definition_id = self.form_definition_id

        form_data: dict[str, Any] | None
        if isinstance(self.form_data, UpdateSubmissionStatusResponse200SubmissionFormDataType0):
            form_data = self.form_data.to_dict()
        else:
            form_data = self.form_data

        manuscript_version_id: None | str
        if isinstance(self.manuscript_version_id, UUID):
            manuscript_version_id = str(self.manuscript_version_id)
        else:
            manuscript_version_id = self.manuscript_version_id

        status = self.status.value

        submitted_at: None | str
        if isinstance(self.submitted_at, datetime.datetime):
            submitted_at = self.submitted_at.isoformat()
        else:
            submitted_at = self.submitted_at

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "submitterId": submitter_id,
            "submissionPeriodId": submission_period_id,
            "title": title,
            "content": content,
            "coverLetter": cover_letter,
            "formDefinitionId": form_definition_id,
            "formData": form_data,
            "manuscriptVersionId": manuscript_version_id,
            "status": status,
            "submittedAt": submitted_at,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_submission_status_response_200_submission_form_data_type_0 import UpdateSubmissionStatusResponse200SubmissionFormDataType0
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        def _parse_submitter_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                submitter_id_type_0 = UUID(data)



                return submitter_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        submitter_id = _parse_submitter_id(d.pop("submitterId"))


        def _parse_submission_period_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                submission_period_id_type_0 = UUID(data)



                return submission_period_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        submission_period_id = _parse_submission_period_id(d.pop("submissionPeriodId"))


        def _parse_title(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        title = _parse_title(d.pop("title"))


        def _parse_content(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        content = _parse_content(d.pop("content"))


        def _parse_cover_letter(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        cover_letter = _parse_cover_letter(d.pop("coverLetter"))


        def _parse_form_definition_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                form_definition_id_type_0 = UUID(data)



                return form_definition_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        form_definition_id = _parse_form_definition_id(d.pop("formDefinitionId"))


        def _parse_form_data(data: object) -> None | UpdateSubmissionStatusResponse200SubmissionFormDataType0:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                form_data_type_0 = UpdateSubmissionStatusResponse200SubmissionFormDataType0.from_dict(data)



                return form_data_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UpdateSubmissionStatusResponse200SubmissionFormDataType0, data)

        form_data = _parse_form_data(d.pop("formData"))


        def _parse_manuscript_version_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                manuscript_version_id_type_0 = UUID(data)



                return manuscript_version_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        manuscript_version_id = _parse_manuscript_version_id(d.pop("manuscriptVersionId"))


        status = UpdateSubmissionStatusResponse200SubmissionStatus(d.pop("status"))




        def _parse_submitted_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                submitted_at_type_0 = isoparse(data)



                return submitted_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        submitted_at = _parse_submitted_at(d.pop("submittedAt"))


        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        update_submission_status_response_200_submission = cls(
            id=id,
            organization_id=organization_id,
            submitter_id=submitter_id,
            submission_period_id=submission_period_id,
            title=title,
            content=content,
            cover_letter=cover_letter,
            form_definition_id=form_definition_id,
            form_data=form_data,
            manuscript_version_id=manuscript_version_id,
            status=status,
            submitted_at=submitted_at,
            created_at=created_at,
            updated_at=updated_at,
        )


        update_submission_status_response_200_submission.additional_properties = d
        return update_submission_status_response_200_submission

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
