from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.update_submission_body_form_data import UpdateSubmissionBodyFormData





T = TypeVar("T", bound="UpdateSubmissionBody")



@_attrs_define
class UpdateSubmissionBody:
    """ 
        Attributes:
            title (str | Unset): New title for the submission
            content (str | Unset): New body content
            cover_letter (str | Unset): New cover letter
            form_data (UpdateSubmissionBodyFormData | Unset): Updated structured form data keyed by field key
     """

    title: str | Unset = UNSET
    content: str | Unset = UNSET
    cover_letter: str | Unset = UNSET
    form_data: UpdateSubmissionBodyFormData | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_submission_body_form_data import UpdateSubmissionBodyFormData
        title = self.title

        content = self.content

        cover_letter = self.cover_letter

        form_data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.form_data, Unset):
            form_data = self.form_data.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if title is not UNSET:
            field_dict["title"] = title
        if content is not UNSET:
            field_dict["content"] = content
        if cover_letter is not UNSET:
            field_dict["coverLetter"] = cover_letter
        if form_data is not UNSET:
            field_dict["formData"] = form_data

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_submission_body_form_data import UpdateSubmissionBodyFormData
        d = dict(src_dict)
        title = d.pop("title", UNSET)

        content = d.pop("content", UNSET)

        cover_letter = d.pop("coverLetter", UNSET)

        _form_data = d.pop("formData", UNSET)
        form_data: UpdateSubmissionBodyFormData | Unset
        if isinstance(_form_data,  Unset):
            form_data = UNSET
        else:
            form_data = UpdateSubmissionBodyFormData.from_dict(_form_data)




        update_submission_body = cls(
            title=title,
            content=content,
            cover_letter=cover_letter,
            form_data=form_data,
        )


        update_submission_body.additional_properties = d
        return update_submission_body

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
