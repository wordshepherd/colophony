from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.withdraw_submission_body import WithdrawSubmissionBody
from ...models.withdraw_submission_response_200 import WithdrawSubmissionResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: WithdrawSubmissionBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/submissions/{id}/withdraw".format(id=quote(str(id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> WithdrawSubmissionResponse200 | None:
    if response.status_code == 200:
        response_200 = WithdrawSubmissionResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[WithdrawSubmissionResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: WithdrawSubmissionBody | Unset = UNSET,

) -> Response[WithdrawSubmissionResponse200]:
    """ Withdraw a submission

     Withdraw a submission from consideration. Allowed from DRAFT, SUBMITTED, UNDER_REVIEW, or HOLD
    status.

    Args:
        id (UUID): Resource UUID
        body (WithdrawSubmissionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[WithdrawSubmissionResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: WithdrawSubmissionBody | Unset = UNSET,

) -> WithdrawSubmissionResponse200 | None:
    """ Withdraw a submission

     Withdraw a submission from consideration. Allowed from DRAFT, SUBMITTED, UNDER_REVIEW, or HOLD
    status.

    Args:
        id (UUID): Resource UUID
        body (WithdrawSubmissionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        WithdrawSubmissionResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: WithdrawSubmissionBody | Unset = UNSET,

) -> Response[WithdrawSubmissionResponse200]:
    """ Withdraw a submission

     Withdraw a submission from consideration. Allowed from DRAFT, SUBMITTED, UNDER_REVIEW, or HOLD
    status.

    Args:
        id (UUID): Resource UUID
        body (WithdrawSubmissionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[WithdrawSubmissionResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: WithdrawSubmissionBody | Unset = UNSET,

) -> WithdrawSubmissionResponse200 | None:
    """ Withdraw a submission

     Withdraw a submission from consideration. Allowed from DRAFT, SUBMITTED, UNDER_REVIEW, or HOLD
    status.

    Args:
        id (UUID): Resource UUID
        body (WithdrawSubmissionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        WithdrawSubmissionResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
