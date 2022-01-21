/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('reflect-metadata');

import * as ws from 'ws';
import * as express from 'express';

import { suite, test } from 'mocha-typescript';
import * as chai from 'chai';
const expect = chai.expect;

import { WsLayer } from './ws-layer';
import { fail } from 'assert';
import { WsErrorHandler, WsRequestHandler } from './ws-handler';

const shouldBeCaughtError = new Error('Should be caught');
const throwErrorCaught = () => {
  throw shouldBeCaughtError;
};
const failNotExecuted = () => fail('Should not be executed!');
const fakeWs = {} as ws;
const fakeReq = {} as express.Request;

@suite
class TestWsLayer {
  @test async testSimple() {
    const seq: number[] = [];
    const handler1: WsRequestHandler = (ws, req, next) => {
      seq.push(1);
      next();
    };
    const handler2: WsRequestHandler = (ws, req, next) => {
      seq.push(2);
      next();
    };
    const handler3: WsRequestHandler = (ws, req, next) => {
      seq.push(3);
      next();
    };
    const stack = WsLayer.createStack(handler1, handler2, handler3);

    await stack.dispatch(fakeWs, fakeReq);

    expect(seq, 'Sequences do not match').to.deep.ordered.members([1, 2, 3]);
  }

  @test async doesNotCallNext() {
    const seq: number[] = [];
    const handler1: WsRequestHandler = (ws, req, next) => {
      seq.push(1);
    };
    const handler2: WsRequestHandler = (ws, req, next) => {
      failNotExecuted;
    };
    const stack = WsLayer.createStack(handler1, handler2);

    await stack.dispatch(fakeWs, fakeReq);

    expect(seq, 'Sequences do not match').to.deep.ordered.members([1]);
  }

  @test async errorHandlingSimpleCalled() {
    const seq: number[] = [];
    const handler1: WsRequestHandler = (ws, req, next) => {
      seq.push(1);
      throwErrorCaught();
      next();
    };
    const handler2: WsErrorHandler = (err, ws, req, next) => {
      seq.push(2);
      expect(err).to.equal(shouldBeCaughtError);
    };
    const stack = WsLayer.createStack(handler1, handler2);

    await stack.dispatch(fakeWs, fakeReq);

    expect(seq, 'Sequences do not match').to.deep.ordered.members([1, 2]);
  }

  @test async errorHandlingSimpleNotCalled() {
    const seq: number[] = [];
    const handler1: WsRequestHandler = (ws, req, next) => {
      seq.push(1);
      throwErrorCaught();
    };
    const handler2: WsRequestHandler = (ws, req, next) => {
      seq.push(2);
      failNotExecuted;
      next();
    };
    const handler3: WsErrorHandler = (err, ws, req, next) => {
      seq.push(3);
      expect(err).to.equal(shouldBeCaughtError);
      next(err);
    };
    const handler4: WsRequestHandler = (ws, req, next) => {
      seq.push(4);
      failNotExecuted;
      next();
    };
    const stack = WsLayer.createStack(handler1, handler2, handler3, handler4);

    await stack.dispatch(fakeWs, fakeReq);

    expect(seq, 'Sequences do not match').to.deep.ordered.members([1, 3]);
  }

  @test async errorHandlingChained() {
    const seq: number[] = [];
    const handler1: WsRequestHandler = (ws, req, next) => {
      seq.push(1);
      throwErrorCaught();
    };
    const handler2: WsErrorHandler = (err, ws, req, next) => {
      seq.push(2);
      expect(err).to.equal(shouldBeCaughtError);
      next(err);
    };
    const handler3: WsErrorHandler = (err, ws, req, next) => {
      seq.push(3);
      expect(err).to.equal(shouldBeCaughtError);
    };
    const stack = WsLayer.createStack(handler1, handler2, handler3);

    await stack.dispatch(fakeWs, fakeReq);

    expect(seq, 'Sequences do not match').to.deep.ordered.members([1, 2, 3]);
  }

  @test async errorHandlingRecover() {
    const seq: number[] = [];
    const handler1: WsRequestHandler = (ws, req, next) => {
      seq.push(1);
      throwErrorCaught();
    };
    const handler2: WsErrorHandler = (err, ws, req, next) => {
      seq.push(2);
      expect(err).to.equal(shouldBeCaughtError);
      next();
    };
    const handler3: WsRequestHandler = (ws, req, next) => {
      seq.push(3);
      next();
    };
    const stack = WsLayer.createStack(handler1, handler2, handler3);

    await stack.dispatch(fakeWs, fakeReq);

    expect(seq, 'Sequences do not match').to.deep.ordered.members([1, 2, 3]);
  }

  @test async errorHandlingDuringErrorHandlingAndRecover() {
    const secondError = new Error('2nd error in a row');
    const seq: number[] = [];
    const handler1: WsRequestHandler = (ws, req, next) => {
      seq.push(1);
      throwErrorCaught();
    };
    const handler2: WsErrorHandler = (err, ws, req, next) => {
      seq.push(2);
      expect(err).to.equal(shouldBeCaughtError);
      throw secondError;
    };
    const handler3: WsRequestHandler = (ws, req, next) => {
      seq.push(3);
      failNotExecuted();
    };
    const handler4: WsErrorHandler = (err, ws, req, next) => {
      seq.push(4);
      expect(err).to.equal(secondError);
      next();
    };
    const handler5: WsRequestHandler = (ws, req, next) => {
      seq.push(5);
      next();
    };
    const stack = WsLayer.createStack(handler1, handler2, handler3, handler4, handler5);

    await stack.dispatch(fakeWs, fakeReq);

    expect(seq, 'Sequences do not match').to.deep.ordered.members([1, 2, 4, 5]);
  }
}
module.exports = TestWsLayer;
