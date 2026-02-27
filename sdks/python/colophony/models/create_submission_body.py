from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.create_submission_body_form_data import CreateSubmissionBodyFormData





T = TypeVar("T", bound="CreateSubmissionBody")



@_attrs_define
class CreateSubmissionBody:
    """ 
        Attributes:
            title (str): Title of the submission (1-500 chars)
            content (str | Unset): Body content (max 50,000 chars)
            cover_letter (str | Unset): Optional cover letter (max 10,000 chars)
            submission_period_id (UUID | Unset): Submission period to associate with
            form_definition_id (UUID | Unset): Form definition to use for structured data
            form_data (CreateSubmissionBodyFormData | Unset): Structured form data keyed by field key
            manuscript_version_id (UUID | Unset): Manuscript version to attach to this submission
     """

    title: str
    content: str | Unset = UNSET
    cover_letter: str | Unset = UNSET
    submission_period_id: UUID | Unset = UNSET
    form_definition_id: UUID | Unset = UNSET
    form_data: CreateSubmissionBodyFormData | Unset = UNSET
    manuscript_version_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_submission_body_form_data import CreateSubmissionBodyFormData
        title = self.title

        content = self.content

        cover_letter = self.cover_letter

        submission_period_id: str | Unset = UNSET
        if not isinstance(self.submission_period_id, Unset):
            submission_period_id = str(self.submission_period_id)

        form_definition_id: str | Unset = UNSET
        if not isinstance(self.form_definition_id, Unset):
            form_definition_id = str(self.form_definition_id)

        form_data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.form_data, Unset):
            form_data = self.form_data.to_dict()

        manuscript_version_id: str | Unset = UNSET
        if not isinstance(self.manuscript_version_id, Unset):
            manuscript_version_id = str(self.manuscript_version_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "title": title,
        })
        if content is not UNSET:
            field_dict["content"] = content
        if cover_letter is not UNSET:
            field_dict["coverLetter"] = cover_letter
        if submission_period_id is not UNSET:
            field_dict["submissionPeriodId"] = submission_period_id
        if form_definition_id is not UNSET:
            field_dict["formDefinitionId"] = form_definition_id
        if form_data is not UNSET:
            field_dict["formData"] = form_data
        if manuscript_version_id is not UNSET:
            field_dict["manuscriptVersionId"] = manuscript_version_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_submission_body_form_data import CreateSubmissionBodyFormData
        d = dict(src_dict)
        title = d.pop("title")

        content = d.pop("content", UNSET)

        cover_letter = d.pop("coverLetter", UNSET)

        _submission_period_id = d.pop("submissionPeriodId", UNSET)
        submission_period_id: UUID | Unset
        if isinstance(_submission_period_id,  Unset):
            submission_period_id = UNSET
        else:
            submission_period_id = UUID(_submission_period_id)




        _form_definition_id = d.pop("formDefinitionId", UNSET)
        form_definition_id: UUID | Unset
        if isinstance(_form_definition_id,  Unset):
            form_definition_id = UNSET
        else:
            form_definition_id = UUID(_form_definition_id)




        _form_data = d.pop("formData", UNSET)
        form_data: CreateSubmissionBodyFormData | Unset
        if isinstance(_form_data,  Unset):
            form_data = UNSET
        else:
            form_data = CreateSubmissionBodyFormData.from_dict(_form_data)




        _manuscript_version_id = d.pop("manuscriptVersionId", UNSET)
        manuscript_version_id: UUID | Unset
        if isinstance(_manuscript_version_id,  Unset):
            manuscript_version_id = UNSET
        else:
            manuscript_version_id = UUID(_manuscript_version_id)




        create_submission_body = cls(
            title=title,
            content=content,
            cover_letter=cover_letter,
            submission_period_id=submission_period_id,
            form_definition_id=form_definition_id,
            form_data=form_data,
            manuscript_version_id=manuscript_version_id,
        )


        create_submission_body.additional_properties = d
        return create_submission_body

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
